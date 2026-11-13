import { z } from 'zod';

import type { Fetcher } from '../_shared/fetcher.ts';

/** A gym as found in OpenStreetMap. */
export type OsmGym = {
  osm_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
};

// Metropolitan France + Corsica, used when a name search has no location hint.
export const FRANCE_BBOX = '41.3,-5.2,51.1,9.6';
const NAME_SEARCH_RADIUS_M = 30000;

/**
 * Makes user text safe for an Overpass regex inside a double-quoted string:
 * backslashes and quotes are dropped, regex metacharacters are escaped (`\\.` in the query).
 */
export function escapeOverpassRegex(input: string): string {
  return input.replace(/[\\"]/g, '').replace(/[.*+?^${}()|[\]]/g, (c) => `\\\\${c}`);
}

export function nearQuery(lat: number, lng: number, radiusM: number, limit = 60): string {
  return `[out:json][timeout:20];nwr["leisure"="fitness_centre"](around:${radiusM},${lat},${lng});out center tags ${limit};`;
}

export function nameQuery(
  name: string,
  near: { lat: number; lng: number } | null,
  limit = 60,
): string {
  const filter = `["leisure"="fitness_centre"]["name"~"${escapeOverpassRegex(name)}",i]`;
  const area = near
    ? `(around:${NAME_SEARCH_RADIUS_M},${near.lat},${near.lng})`
    : `(${FRANCE_BBOX})`;
  return `[out:json][timeout:25];nwr${filter}${area};out center tags ${limit};`;
}

const elementSchema = z.object({
  type: z.enum(['node', 'way', 'relation']),
  id: z.number().int().positive(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

const responseSchema = z.object({ elements: z.array(z.unknown()) });

function formatAddress(tags: Record<string, string>): string | null {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  const parts = [street, city].filter((p) => p.length > 0);
  return parts.length ? parts.join(', ') : null;
}

/** Keeps named gyms with a position; drops malformed elements. */
export function parseOverpass(payload: unknown): OsmGym[] {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) return [];
  const gyms: OsmGym[] = [];
  const seen = new Set<string>();
  for (const raw of parsed.data.elements) {
    const el = elementSchema.safeParse(raw);
    if (!el.success) continue;
    const { type, id, tags } = el.data;
    const lat = el.data.lat ?? el.data.center?.lat;
    const lng = el.data.lon ?? el.data.center?.lon;
    const name = tags?.name?.trim();
    if (lat === undefined || lng === undefined || !name) continue;
    const osmId = `${type}/${id}`;
    if (seen.has(osmId)) continue;
    seen.add(osmId);
    gyms.push({
      osm_id: osmId,
      name: name.slice(0, 200),
      lat,
      lng,
      address: formatAddress(tags ?? {}),
    });
  }
  return gyms;
}

export type { Fetcher };

// Overpass instances now answer 406 to clients that do not identify themselves (OSM community
// policy, 2026): name the app and give a contact URL, plus a Referer.
export const OVERPASS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'application/json',
  'User-Agent':
    'DipsOrChips/1.0 (gym search for a fitness app; +https://pulseaiagency.github.io/dipsorchips/)',
  Referer: 'https://pulseaiagency.github.io/dipsorchips/',
} as const;

export async function runOverpass(
  fetcher: Fetcher,
  endpoint: string,
  query: string,
): Promise<OsmGym[]> {
  const res = await fetcher(endpoint, {
    method: 'POST',
    headers: OVERPASS_HEADERS,
    body: `data=${encodeURIComponent(query)}`,
    // Saturated instances can hang: give each one 12 s, then try the next.
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`overpass_http_${res.status}`);
  return parseOverpass(await res.json());
}

/** Tries each public instance in turn; throws the last error if none answers. */
export async function runOverpassAny(
  fetcher: Fetcher,
  endpoints: readonly string[],
  query: string,
): Promise<OsmGym[]> {
  let last: unknown = new Error('overpass_no_endpoint');
  for (const endpoint of endpoints) {
    try {
      return await runOverpass(fetcher, endpoint, query);
    } catch (err) {
      last = err;
    }
  }
  throw last;
}
