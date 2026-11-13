import { z } from 'zod';

import type { Fetcher } from '../_shared/fetcher.ts';
import { HttpError } from '../_shared/http.ts';
import type { OsmGym } from './overpass.ts';

// Verifies a gym picked on the phone against the official OpenStreetMap API (reachable from
// the server, unlike the throttled public search services): it must exist and be tagged
// leisure=fitness_centre. Position = the node, or the centre of the way's nodes.
export const OSM_API_URL = 'https://api.openstreetmap.org/api/0.6';

export const OSM_API_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Noxcuse/1.0 (gym search for a fitness app; +https://pulseaiagency.github.io/noxcuse/)',
} as const;

export const osmIdSchema = z.string().regex(/^(node|way)\/[0-9]{1,15}$/);

const elementSchema = z.object({
  type: z.enum(['node', 'way', 'relation']),
  id: z.number(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});
const payloadSchema = z.object({ elements: z.array(z.unknown()) });

function formatAddress(tags: Record<string, string>): string | null {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  const parts = [street, city].filter((p) => p.length > 0);
  return parts.length ? parts.join(', ') : null;
}

/** Turns an OSM API payload into a gym, or throws `not_a_gym` / `gym_not_found`. */
export function gymFromOsmPayload(osmId: string, payload: unknown): OsmGym {
  const [type, rawId] = osmId.split('/');
  const id = Number(rawId);
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new HttpError(404, 'gym_not_found');
  const elements = parsed.data.elements
    .map((e) => elementSchema.safeParse(e))
    .filter((r) => r.success)
    .map((r) => r.data!);
  const main = elements.find((e) => e.type === type && e.id === id);
  if (!main) throw new HttpError(404, 'gym_not_found');
  const tags = main.tags ?? {};
  const name = tags.name?.trim();
  if (tags.leisure !== 'fitness_centre' || !name) throw new HttpError(422, 'not_a_gym');

  let lat = main.lat;
  let lng = main.lon;
  if (type === 'way') {
    const nodes = elements.filter((e) => e.type === 'node' && e.lat !== undefined);
    if (nodes.length) {
      lat = nodes.reduce((s, n) => s + n.lat!, 0) / nodes.length;
      lng = nodes.reduce((s, n) => s + n.lon!, 0) / nodes.length;
    }
  }
  if (lat === undefined || lng === undefined) throw new HttpError(404, 'gym_not_found');
  return { osm_id: osmId, name: name.slice(0, 200), lat, lng, address: formatAddress(tags) };
}

export async function fetchOsmGym(fetcher: Fetcher, base: string, osmId: string): Promise<OsmGym> {
  const [type, id] = osmId.split('/');
  const url = type === 'way' ? `${base}/way/${id}/full.json` : `${base}/node/${id}.json`;
  const res = await fetcher(url, {
    method: 'GET',
    headers: OSM_API_HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404 || res.status === 410) throw new HttpError(404, 'gym_not_found');
  if (!res.ok) throw new HttpError(503, 'gym_search_unavailable');
  return gymFromOsmPayload(osmId, await res.json());
}
