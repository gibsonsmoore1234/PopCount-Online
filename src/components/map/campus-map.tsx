"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { auraColor, formatAura } from "@/lib/aura";
import type { BubbleSummary } from "@/types/api";

/** Panning limit: the continental U.S. with an ocean margin. */
const US_BOUNDS = L.latLngBounds([15, -140], [56, -50]);
/** Initial / "reset" framing: the lower 48. */
const CONTINENTAL = L.latLngBounds([24.4, -124.8], [49.4, -66.9]);

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Bubble diameter: area grows with membership (√members), and the whole layer shrinks when zoomed
 * out to the national view so neighbouring campuses don't pile on top of each other.
 */
export function bubbleDiameter(members: number, zoom: number) {
  const base = Math.max(58, Math.min(150, 46 + 11 * Math.sqrt(members)));
  const scale = Math.max(0.42, Math.min(1, 0.42 + 0.16 * (zoom - 3)));
  return Math.round(Math.max(48, base * scale));
}

function bubbleIcon(b: BubbleSummary, zoom: number) {
  const d = bubbleDiameter(b.memberCount, zoom);
  const members = `• ${b.memberCount.toLocaleString("en-US")} Members`;
  // Fit both lines inside the circle's inner chord (≈80% of the diameter).
  const avail = d * 0.8 - 8;
  const nameSize = Math.max(6, Math.min(16, d / 7, avail / (b.name.length * 0.66)));
  const memberSize = Math.max(5.5, Math.min(12, d / 10, avail / (members.length * 0.56)));
  // Strictly two lines inside the bubble: the name, and the member count.
  const html = `
    <div class="pc-bubble" style="--pc-ring:${auraColor(b.avgAura)}" role="button" tabindex="0" aria-label="${escapeHtml(b.name)}, ${b.memberCount} members">
      <span class="pc-bubble__name" style="font-size:${nameSize}px">${escapeHtml(b.name)}</span>
      <span class="pc-bubble__members" style="font-size:${memberSize}px">${members}</span>
    </div>`;
  return L.divIcon({ html, className: "pc-bubble-wrap", iconSize: [d, d], iconAnchor: [d / 2, d / 2] });
}

const pendingIcon = L.divIcon({
  html: '<div class="pc-bubble-pending"></div>',
  className: "pc-bubble-wrap",
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

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
  const sorted = useMemo(() => [...bubbles].sort((a, b) => b.memberCount - a.memberCount), [bubbles]);

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
      worldCopyJump={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
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
          icon={bubbleIcon(b, zoom)}
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
            offset={[0, -bubbleDiameter(b.memberCount, zoom) / 2]}
            className="pc-tooltip"
            opacity={1}
          >
            <div className="min-w-44 space-y-0.5">
              <div className="text-xs font-black uppercase">{b.name}</div>
              <div className="text-muted text-[11px] font-semibold">
                {b.countyName}, {b.stateName}
              </div>
              <div className="flex items-center gap-2 pt-1 text-[11px] font-extrabold">
                <span className="border-ink rounded-full border-2 px-1.5" style={{ background: auraColor(b.avgAura) }}>
                  {formatAura(b.avgAura)} avg
                </span>
                <span>{b.profileCount} profiles</span>
                <span>{b.totalVotes.toLocaleString()} votes</span>
              </div>
            </div>
          </Tooltip>
        </Marker>
      ))}

      {pendingPin && <Marker position={[pendingPin.lat, pendingPin.lng]} icon={pendingIcon} interactive={false} />}
    </MapContainer>
  );
}
