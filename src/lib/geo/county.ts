import { geoBounds, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import countiesTopo from "us-atlas/counties-10m.json";

/**
 * Offline U.S. county lookup (Census cartographic boundaries via us-atlas).
 * Used to place bubbles and enforce the 100-pins-per-county cap without any external geocoder.
 */
export type CountyMatch = { fips: string; county: string; state: string };

type Indexed = { f: Feature<Geometry, { name: string }>; bbox: [[number, number], [number, number]] | null };

let index: { counties: Indexed[]; states: Map<string, string> } | null = null;

function load() {
  if (index) return index;
  const topo = countiesTopo as unknown as Topology<{
    counties: GeometryCollection<{ name: string }>;
    states: GeometryCollection<{ name: string }>;
  }>;
  const counties = feature(topo, topo.objects.counties).features as Feature<Geometry, { name: string }>[];
  const states = feature(topo, topo.objects.states).features as Feature<Geometry, { name: string }>[];
  index = {
    counties: counties.map((f) => {
      const b = geoBounds(f) as [[number, number], [number, number]];
      // Features crossing the antimeridian (Aleutians) report west > east — skip the bbox prefilter for those.
      return { f, bbox: b[0][0] <= b[1][0] ? b : null };
    }),
    states: new Map(states.map((s) => [String(s.id), s.properties.name])),
  };
  return index;
}

export function lookupCounty(lat: number, lng: number): CountyMatch | null {
  const { counties, states } = load();
  const pt: [number, number] = [lng, lat];
  for (const { f, bbox } of counties) {
    if (bbox && (lng < bbox[0][0] || lng > bbox[1][0] || lat < bbox[0][1] || lat > bbox[1][1])) continue;
    if (geoContains(f, pt)) {
      const fips = String(f.id);
      return { fips, county: f.properties.name, state: states.get(fips.slice(0, 2)) ?? "" };
    }
  }
  return null;
}

export const MAX_BUBBLES_PER_COUNTY = 100;
