import { z } from 'zod';

import type { Authenticator } from '../_shared/auth.ts';
import { coarse, distanceMeters } from '../_shared/geo.ts';
import { corsHeaders, errorResponse, HttpError, json, log, readJson } from '../_shared/http.ts';
import { nameUrl, nearUrl, runNominatim } from './nominatim.ts';
import { fetchOsmGym, OSM_API_URL, osmIdSchema } from './osmapi.ts';
import { type Fetcher, nameQuery, nearQuery, type OsmGym, runOverpassAny } from './overpass.ts';

export type GymRow = OsmGym & { id: string };

export interface GymStore {
  /** Gyms cached under `key` if the entry is younger than `maxAgeMs`, else null. */
  getCached(key: string, maxAgeMs: number): Promise<GymRow[] | null>;
  upsertGyms(gyms: OsmGym[]): Promise<GymRow[]>;
  putCache(key: string, gymIds: string[]): Promise<void>;
  findByOsmId(osmId: string): Promise<GymRow | null>;
}

export type Deps = {
  authenticate: Authenticator;
  store: GymStore;
  fetcher: Fetcher;
  /** Overpass endpoints, tried in order (main instance, then mirrors). */
  overpassUrls: readonly string[];
  /** Query Nominatim first (fast); Overpass is then the fallback. Off in unit tests. */
  useNominatim?: boolean;
  /** OpenStreetMap API used to verify a gym picked on the phone. */
  osmApiUrl?: string;
  now?: () => number;
};

const point = { lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) };

export const resolveSchema = z.object({ mode: z.literal('resolve'), osm_id: osmIdSchema });

export const inputSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('near'),
    ...point,
    radius_m: z.number().int().min(300).max(5000).default(2000),
  }),
  z.object({
    mode: z.literal('name'),
    query: z.string().trim().min(2).max(60),
    lat: point.lat.optional(),
    lng: point.lng.optional(),
  }),
]);

const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
const MAX_RESULTS = 50;

export function cacheKey(input: z.infer<typeof inputSchema>): string {
  if (input.mode === 'near')
    return `near:${coarse(input.lat)},${coarse(input.lng)}:${input.radius_m}`;
  const where =
    input.lat !== undefined && input.lng !== undefined
      ? `${coarse(input.lat)},${coarse(input.lng)}`
      : 'fr';
  return `name:${input.query.toLowerCase().normalize('NFKD').replace(/\s+/g, ' ')}:${where}`;
}

function sortGyms(gyms: GymRow[], ref: { lat: number; lng: number } | null): GymRow[] {
  const sorted = [...gyms];
  if (ref) {
    sorted.sort(
      (a, b) =>
        distanceMeters(ref.lat, ref.lng, a.lat, a.lng) -
        distanceMeters(ref.lat, ref.lng, b.lat, b.lng),
    );
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  return sorted.slice(0, MAX_RESULTS);
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      await deps.authenticate(req);
      const body = await readJson(req);

      // The phone searched OSM itself; verify the pick against the OSM API and store it.
      const resolve = resolveSchema.safeParse(body);
      if (resolve.success) {
        const known = await deps.store.findByOsmId(resolve.data.osm_id);
        if (known) return json({ gym: known });
        const gym = await fetchOsmGym(
          deps.fetcher,
          deps.osmApiUrl ?? OSM_API_URL,
          resolve.data.osm_id,
        );
        const [row] = await deps.store.upsertGyms([gym]);
        log('info', 'search-gyms', 'resolved', { osm_type: gym.osm_id.split('/')[0] });
        return json({ gym: row });
      }

      const parsed = inputSchema.safeParse(body);
      if (!parsed.success) throw new HttpError(400, 'invalid_input');
      const input = parsed.data;

      // Never use more than ~1 km precision, even if the client sent more.
      const ref =
        input.lat !== undefined && input.lng !== undefined
          ? { lat: coarse(input.lat), lng: coarse(input.lng) }
          : null;
      const key = cacheKey(input);

      const cached = await deps.store.getCached(key, CACHE_TTL_MS);
      if (cached) return json({ gyms: sortGyms(cached, ref), cached: true });

      let found: OsmGym[] | null = null;
      if (deps.useNominatim) {
        try {
          const url =
            input.mode === 'near'
              ? nearUrl(ref!.lat, ref!.lng, input.radius_m)
              : nameUrl(input.query, ref);
          const hits = await runNominatim(deps.fetcher, url);
          if (hits.length) found = hits;
        } catch (err) {
          log('warn', 'search-gyms', 'nominatim_failed', {
            reason: err instanceof Error ? err.message : 'unknown',
          });
        }
      }
      if (!found) {
        const query =
          input.mode === 'near'
            ? nearQuery(ref!.lat, ref!.lng, input.radius_m)
            : nameQuery(input.query, ref);
        try {
          found = await runOverpassAny(deps.fetcher, deps.overpassUrls, query);
        } catch (err) {
          log('warn', 'search-gyms', 'overpass_failed', {
            reason: err instanceof Error ? err.message : 'unknown',
          });
          throw new HttpError(503, 'gym_search_unavailable');
        }
      }

      const rows = await deps.store.upsertGyms(found);
      await deps.store.putCache(
        key,
        rows.map((g) => g.id),
      );
      log('info', 'search-gyms', 'searched', { mode: input.mode, results: rows.length });
      return json({ gyms: sortGyms(rows, ref), cached: false });
    } catch (err) {
      return errorResponse(err, 'search-gyms');
    }
  };
}
