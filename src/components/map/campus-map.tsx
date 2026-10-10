"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Feature, FeatureCollection, MultiLineString } from "geojson";
import { auraColor } from "@/lib/aura";
import type { BubbleSummary } from "@/types/api";

/** Panning limit: the continental U.S. with an ocean margin. */
const US_BOUNDS = L.latLngBounds([15, -140], [56, -50]);
/** Initial / "reset" framing: the lower 48. */
const CONTINENTAL = L.latLngBounds([24.4, -124.8], [49.4, -66.9]);

// CARTO basemap key (public: it is sent with every tile request). Override with NEXT_PUBLIC_CARTO_KEY.
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY || "cb1_4fk0_1_7e48971c6d955168286f5af9";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Bubble diameter: area grows with membership (√members), and the whole layer shrinks when zoomed
 * out to the national view so neighbouring campuses don't pile on top of each other.
 */
export function bubbleDiameter(members: number, zoom: number, maxMembers = members, bubbleCount = 1, fit = 1) {
  // Area ∝ members, relative to the biggest bubble: the largest is 150px, a near-empty one 56px.
  const share = Math.sqrt(Math.max(0, members) / Math.max(1, maxMembers));
  const base = 56 + (150 - 56) * share;
  const scale = Math.max(0.5, Math.min(1, 0.5 + 0.14 * (zoom - 3)));
  // The more bubbles on the map, the smaller each one gets (full size up to 6 bubbles).
  const crowd = Math.max(0.35, Math.min(1, Math.sqrt(6 / Math.max(1, bubbleCount))));
  // Never smaller than a 30px tap target.
  return Math.round(Math.max(24, base * scale * crowd * fit));
}

function bubbleIcon(b: BubbleSummary, d: number) {
  const nameSize = Math.max(9, Math.min(13, d / 6));
  // Just the picture filling the circle, the ring in the score colour, and the name underneath.
  const html = `
    <div class="pc-bubble" style="--pc-ring:${auraColor(b.avgAura)}" role="button" tabindex="0" aria-label="${escapeHtml(b.name)}">
      ${
        b.logoUrl
          ? `<img class="pc-bubble__logo" src="${escapeHtml(b.logoUrl)}" alt="" referrerpolicy="no-referrer"/>`
          : `<span class="pc-bubble__initials" style="font-size:${Math.round(d / 3)}px">${escapeHtml(b.name.slice(0, 2))}</span>`
      }
      ${d >= 24 ? `<span class="pc-bubble__name" style="font-size:${nameSize}px">${escapeHtml(b.name)}</span>` : ""}
    </div>`;
  return L.divIcon({ html, className: "pc-bubble-wrap", iconSize: [d, d], iconAnchor: [d / 2, d / 2] });
}

const pendingIcon = L.divIcon({
  html: '<div class="pc-bubble-pending"></div>',
  className: "pc-bubble-wrap",
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

/* ── Cut-out U.S. vector canvas ─────────────────────────────────────── */
const GREYS = ["#d4d4d8", "#b4b4bb", "#93939b"] as const;
type UsGeo = { counties: FeatureCollection; states: MultiLineString; outline: MultiLineString };

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Counties painted in the three Aura colours: bubble counties take their bubble's average, the rest a state palette. */
function countyColor(fips: string, byCounty: Map<string, number | null>) {
  if (byCounty.has(fips)) return "#52525b";
  return GREYS[(hash(fips.slice(0, 2)) + (hash(fips) % 7 === 0 ? 1 : 0)) % 3];
}

let geoPromise: Promise<UsGeo> | null = null;
/** The U.S. county/state shapes, fetched once and shared by every map layer. */
function useUsGeo() {
  const [geo, setGeo] = useState<UsGeo | null>(null);
  useEffect(() => {
    let alive = true;
    geoPromise ??= fetch("/api/geo/us").then((r) => r.json() as Promise<UsGeo>);
    geoPromise.then((g) => alive && setGeo(g)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return geo;
}

type Box = [number, number, number, number]; // minLng, minLat, maxLng, maxLat
/** Bounding boxes of every county (by FIPS) and every state (by 2-digit FIPS). */
function regionBoxes(geo: UsGeo) {
  const county = new Map<string, Box>();
  const state = new Map<string, Box>();
  const grow = (m: Map<string, Box>, k: string, b: Box) => {
    const o = m.get(k);
    m.set(k, o ? [Math.min(o[0], b[0]), Math.min(o[1], b[1]), Math.max(o[2], b[2]), Math.max(o[3], b[3])] : b);
  };
  const walk = (c: unknown, b: Box) => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      b[0] = Math.min(b[0], x);
      b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x);
      b[3] = Math.max(b[3], y);
    } else if (Array.isArray(c)) for (const k of c) walk(k, b);
  };
  for (const f of geo.counties.features) {
    const fips = String(f.id ?? "").padStart(5, "0");
    const b: Box = [Infinity, Infinity, -Infinity, -Infinity];
    walk((f.geometry as { coordinates?: unknown }).coordinates, b);
    if (!Number.isFinite(b[0])) continue;
    county.set(fips, b);
    grow(state, fips.slice(0, 2), b);
  }
  return { county, state };
}

function UsCanvas({ bubbles, zoom }: { bubbles: BubbleSummary[]; zoom: number }) {
  const geo = useUsGeo();
  const byCounty = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const b of bubbles) m.set(countyFipsOf(b), b.avgAura);
    return m;
  }, [bubbles]);
  if (!geo) return null;
  // Fade the painted counties out as street-level tiles take over.
  const fill = zoom >= 10 ? 0.12 : zoom >= 8 ? 0.45 : 0.82;
  return (
    <Pane name="us" style={{ zIndex: 350 }}>
      <GeoJSON
        key={`c-${fill}-${byCounty.size}`}
        data={geo.counties}
        style={(f?: Feature) => {
          const fips = String(f?.id ?? "");
          const hasBubble = byCounty.has(fips);
          return {
            fillColor: countyColor(fips, byCounty),
            fillOpacity: hasBubble ? Math.min(1, fill + 0.15) : fill * (0.7 + (hash(fips) % 30) / 100),
            color: "#000",
            weight: zoom >= 6 ? 0.6 : 0.25,
            opacity: 0.55,
          };
        }}
        interactive={false}
      />
      <GeoJSON
        key="states"
        data={geo.states}
        style={{ color: "#000", weight: 1.6, opacity: 0.9 }}
        interactive={false}
      />
      <GeoJSON
        key="outline"
        data={geo.outline}
        style={{ color: "#0a0a0c", weight: 2, opacity: 0.9 }}
        interactive={false}
      />
    </Pane>
  );
}

function countyFipsOf(b: BubbleSummary) {
  return b.countyFips;
}

function ViewTracker({ onChange }: { onChange: (center: [number, number], zoom: number) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onChange([c.lat, c.lng], map.getZoom());
    },
  });
  return null;
}

function PinPicker({ active, onPick }: { active: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (active) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Keep bubbles from overlapping: at the current zoom, push any circles (plus their name label) that
 * collide apart in screen space, then convert back to map coordinates. Re-runs on every zoom change.
 */
type Layout = { pos: Record<string, [number, number]>; size: Record<string, number> };

function SpreadBubbles({
  bubbles,
  zoom,
  maxMembers,
  onLayout,
}: {
  bubbles: BubbleSummary[];
  zoom: number;
  maxMembers: number;
  onLayout: (layout: Layout) => void;
}) {
  const map = useMap();
  const geo = useUsGeo();
  const boxes = useMemo(() => (geo ? regionBoxes(geo) : null), [geo]);
  useEffect(() => {
    const z = map.getZoom();
    const pts = bubbles.map((b) => ({ b, p: map.project([b.lat, b.lng], z) }));
    // Never bigger than the bubble's state — or its county when the state has more than one bubble.
    const perState = new Map<string, number>();
    for (const b of bubbles) perState.set(b.countyFips.slice(0, 2), (perState.get(b.countyFips.slice(0, 2)) ?? 0) + 1);
    const cap = new Map<string, number>();
    const area = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
    for (const b of bubbles) {
      const st = b.countyFips.slice(0, 2);
      const box = boxes && ((perState.get(st) ?? 0) > 1 ? boxes.county.get(b.countyFips) : boxes.state.get(st));
      if (!box) continue;
      const a = map.project([box[1], box[0]], z); // south-west
      const c = map.project([box[3], box[2]], z); // north-east
      const r = { x0: Math.min(a.x, c.x), y0: Math.min(a.y, c.y), x1: Math.max(a.x, c.x), y1: Math.max(a.y, c.y) };
      area.set(b.id, r);
      cap.set(b.id, Math.max(10, Math.min(r.x1 - r.x0, r.y1 - r.y0) * 0.9));
    }
    // Keep a circle of radius `rad` entirely inside its region box.
    const keepInside = (id: string, x: number, y: number, rad: number) => {
      const r = area.get(id);
      if (!r) return { x, y };
      const cx = (r.x0 + r.x1) / 2;
      const cy = (r.y0 + r.y1) / 2;
      return {
        x: r.x1 - r.x0 > 2 * rad ? Math.min(r.x1 - rad, Math.max(r.x0 + rad, x)) : cx,
        y: r.y1 - r.y0 > 2 * rad ? Math.min(r.y1 - rad, Math.max(r.y0 + rad, y)) : cy,
      };
    };
    const sizeOf = (b: BubbleSummary, f: number) =>
      Math.min(bubbleDiameter(b.profileCount, zoom, maxMembers, bubbles.length, f), cap.get(b.id) ?? Infinity);
    const radius = (b: BubbleSummary, f: number) => sizeOf(b, f) / 2;
    // 1) Crowded? Shrink every bubble until the tightest pair no longer touches (down to 40%).
    let fit = 1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].p.x - pts[j].p.x, pts[i].p.y - pts[j].p.y);
        const need = radius(pts[i].b, 1) + radius(pts[j].b, 1) + 32;
        if (d < need) fit = Math.min(fit, d / need);
      }
    }
    fit = Math.max(0.4, fit);
    // 2) Anything still touching (e.g. same spot) gets nudged apart. Radius includes the name label.
    const nodes = pts.map(({ b, p }) => {
      const rad = radius(b, fit);
      const at = keepInside(b.id, p.x, p.y, rad);
      return { id: b.id, x: at.x, y: at.y, rad, r: rad + (rad < 18 ? 4 : 14) };
    });
    for (let iter = 0; iter < 120; iter++) {
      let moved = false;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          const min = a.r + b.r + 4;
          if (d >= min) continue;
          if (d < 0.01) {
            // Identical spots: nudge apart in a fixed direction per pair so the result is stable.
            dx = Math.cos(i + j);
            dy = Math.sin(i + j);
            d = 1;
          }
          const push = (min - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
          // Nudging never pushes a bubble out of its state/county.
          Object.assign(a, keepInside(a.id, a.x, a.y, a.rad));
          Object.assign(b, keepInside(b.id, b.x, b.y, b.rad));
          moved = true;
        }
      }
      if (!moved) break;
    }
    const out: Record<string, [number, number]> = {};
    for (const n of nodes) {
      const ll = map.unproject([n.x, n.y], z);
      out[n.id] = [ll.lat, ll.lng];
    }
    const size: Record<string, number> = {};
    for (const { b } of pts) size[b.id] = Math.round(sizeOf(b, fit));
    onLayout({ pos: out, size });
  }, [map, bubbles, zoom, maxMembers, onLayout, boxes]);
  return null;
}

function ResetView({ nonce }: { nonce: number }) {
  const map = useMap();
  useEffect(() => {
    if (nonce) map.flyToBounds(CONTINENTAL, { padding: [16, 16], duration: 0.9 });
  }, [nonce, map]);
  return null;
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
  return null;
}

function SizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function CampusMap({
  bubbles,
  onOpenBubble,
  pinning,
  pendingPin,
  onPick,
  initialView,
  onViewChange,
  resetNonce,
}: {
  bubbles: BubbleSummary[];
  onOpenBubble: (slug: string) => void;
  pinning: boolean;
  pendingPin: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  initialView: { center: [number, number]; zoom: number } | null;
  onViewChange: (center: [number, number], zoom: number) => void;
  resetNonce: number;
}) {
  const [zoom, setZoom] = useState(initialView?.zoom ?? 4);
  const [layout, setLayout] = useState<Layout>({ pos: {}, size: {} });
  const spread = layout.pos;
  const openRef = useRef(onOpenBubble);
  useEffect(() => {
    openRef.current = onOpenBubble;
  }, [onOpenBubble]);

  // Larger bubbles render first so smaller neighbours stay clickable on top.
  const maxMembers = useMemo(() => Math.max(1, ...bubbles.map((b) => b.profileCount)), [bubbles]);
  const sorted = useMemo(() => [...bubbles].sort((a, b) => b.profileCount - a.profileCount), [bubbles]);

  return (
    <MapContainer
      {...(initialView
        ? { center: initialView.center, zoom: initialView.zoom }
        : { bounds: CONTINENTAL, boundsOptions: { padding: [16, 16] as [number, number] } })}
      zoomSnap={0.25}
      minZoom={2.5}
      maxZoom={18}
      maxBounds={US_BOUNDS}
      maxBoundsViscosity={0.8}
      zoomControl={false}
      preferCanvas
      worldCopyJump={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url={`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`}
        maxZoom={19}
        minZoom={7}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <UsCanvas bubbles={bubbles} zoom={zoom} />
      <ZoomControl position="bottomright" />
      <SizeFix />
      <ViewTracker onChange={onViewChange} />
      <PinPicker active={pinning} onPick={onPick} />
      <ResetView nonce={resetNonce} />
      <ZoomTracker onZoom={setZoom} />

      <SpreadBubbles bubbles={sorted} zoom={zoom} maxMembers={maxMembers} onLayout={setLayout} />
      {sorted.map((b) => (
        <Marker
          key={b.id}
          position={spread[b.id] ?? [b.lat, b.lng]}
          icon={bubbleIcon(b, layout.size[b.id] ?? bubbleDiameter(b.profileCount, zoom, maxMembers, sorted.length))}
          riseOnHover
          keyboard
          eventHandlers={{
            click: () => openRef.current(b.slug),
            keypress: (e) => {
              const key = (e.originalEvent as KeyboardEvent).key;
              if (key === "Enter" || key === " ") openRef.current(b.slug);
            },
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -(layout.size[b.id] ?? bubbleDiameter(b.profileCount, zoom, maxMembers, sorted.length)) / 2]}
            className="pc-tooltip"
            opacity={1}
          >
            <div className="text-xs font-black uppercase">{b.name}</div>
          </Tooltip>
        </Marker>
      ))}

      {pendingPin && <Marker position={[pendingPin.lat, pendingPin.lng]} icon={pendingIcon} interactive={false} />}
    </MapContainer>
  );
}
