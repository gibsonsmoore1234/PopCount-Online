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
export function bubbleDiameter(members: number, zoom: number, maxMembers = members, bubbleCount = 1) {
  // Area ∝ members, relative to the biggest bubble: the largest is 150px, a near-empty one 56px.
  const share = Math.sqrt(Math.max(0, members) / Math.max(1, maxMembers));
  const base = 56 + (150 - 56) * share;
  const scale = Math.max(0.5, Math.min(1, 0.5 + 0.14 * (zoom - 3)));
  // The more bubbles on the map, the smaller each one gets (full size up to 6 bubbles).
  const crowd = Math.max(0.35, Math.min(1, Math.sqrt(6 / Math.max(1, bubbleCount))));
  // Never smaller than a 30px tap target.
  return Math.round(Math.max(30, base * scale * crowd));
}

function bubbleIcon(b: BubbleSummary, zoom: number, maxMembers: number, count: number) {
  const d = bubbleDiameter(b.profileCount, zoom, maxMembers, count);
  const nameSize = Math.max(9, Math.min(13, d / 6));
  // Just the picture filling the circle, the ring in the score colour, and the name underneath.
  const html = `
    <div class="pc-bubble" style="--pc-ring:${auraColor(b.avgAura)}" role="button" tabindex="0" aria-label="${escapeHtml(b.name)}">
      ${
        b.logoUrl
          ? `<img class="pc-bubble__logo" src="${escapeHtml(b.logoUrl)}" alt="" referrerpolicy="no-referrer"/>`
          : `<span class="pc-bubble__initials" style="font-size:${Math.round(d / 3)}px">${escapeHtml(b.name.slice(0, 2))}</span>`
      }
      <span class="pc-bubble__name" style="font-size:${nameSize}px">${escapeHtml(b.name)}</span>
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

function UsCanvas({ bubbles, zoom }: { bubbles: BubbleSummary[]; zoom: number }) {
  const [geo, setGeo] = useState<UsGeo | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/geo/us")
      .then((r) => r.json())
      .then((g: UsGeo) => alive && setGeo(g))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
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

      {sorted.map((b) => (
        <Marker
          key={b.id}
          position={[b.lat, b.lng]}
          icon={bubbleIcon(b, zoom, maxMembers, sorted.length)}
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
            offset={[0, -bubbleDiameter(b.profileCount, zoom, maxMembers, sorted.length) / 2]}
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
