import { NextResponse } from "next/server";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import topo from "us-atlas/counties-10m.json";

/** Continental-U.S. vector layers (counties, state lines, nation outline) for the cut-out map canvas. */
let cached: string | null = null;
const NON_CONTINENTAL = new Set(["02", "15", "60", "66", "69", "72", "78"]);

function build() {
  const t = topo as unknown as Topology<{
    counties: GeometryCollection<{ name: string }>;
    states: GeometryCollection<{ name: string }>;
    nation: GeometryCollection;
  }>;
  const keep = (id: unknown) => !NON_CONTINENTAL.has(String(id).slice(0, 2));
  const counties = feature(t, {
    ...t.objects.counties,
    geometries: t.objects.counties.geometries.filter((g) => keep(g.id)),
  });
  const states = mesh(
    t,
    { ...t.objects.states, geometries: t.objects.states.geometries.filter((g) => keep(g.id)) },
    (a, b) => a !== b,
  );
  const outline = mesh(
    t,
    { ...t.objects.states, geometries: t.objects.states.geometries.filter((g) => keep(g.id)) },
    (a, b) => a === b,
  );
  return JSON.stringify({ counties, states, outline });
}

export function GET() {
  cached ??= build();
  return new NextResponse(cached, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
