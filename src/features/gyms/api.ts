import { useMutation } from '@tanstack/react-query';

import { coarse } from '@/domain/geo';
import {
  NEAR_RADII_M,
  nominatimUrl,
  type OsmGymHit,
  type OsmSearch,
  parseNominatim,
} from '@/domain/osmSearch';
import { functionErrorCode } from '@/lib/errors';
import { db } from '@/lib/supabase';

/** A gym shown in the list. `id` exists once the server has verified and stored it. */
export type FoundGym = OsmGymHit & { id?: string };

export type GymSearch = OsmSearch;

/** Body for the server-side search (fallback): positions rounded to ~1 km. */
export function gymSearchBody(search: GymSearch): Record<string, unknown> {
  if (search.mode === 'near') {
    return { mode: 'near', lat: coarse(search.lat), lng: coarse(search.lng), radius_m: 3000 };
  }
  const near =
    search.lat !== undefined && search.lng !== undefined
      ? { lat: coarse(search.lat), lng: coarse(search.lng) }
      : {};
  return { mode: 'name', query: search.query.trim(), ...near };
}

/** Phone → Nominatim. Each phone has its own IP: OSM services throttle shared cloud servers. */
async function nominatim(url: string): Promise<FoundGym[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'fr',
        Referer: 'https://github.com/Maximus40/noskip',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`nominatim_http_${res.status}`);
    return parseNominatim(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchOnPhone(search: GymSearch): Promise<FoundGym[]> {
  if (search.mode === 'name') return nominatim(nominatimUrl(search));
  // Widen 3 → 10 → 25 km until something shows up (≥ 1 s apart: Nominatim usage policy).
  for (const [i, radius] of NEAR_RADII_M.entries()) {
    if (i > 0) await pause(1100);
    const hits = await nominatim(nominatimUrl(search, radius));
    if (hits.length) return hits;
  }
  return [];
}

async function searchOnServer(search: GymSearch): Promise<FoundGym[]> {
  const { data, error } = await db().functions.invoke<{ gyms: FoundGym[] }>('search-gyms', {
    body: gymSearchBody(search),
  });
  if (error) throw new Error((await functionErrorCode(error)) ?? 'gym_search_unavailable');
  return data?.gyms ?? [];
}

export async function searchGyms(search: GymSearch): Promise<FoundGym[]> {
  try {
    return await searchOnPhone(search);
  } catch {
    return searchOnServer(search);
  }
}

export function useGymSearch() {
  return useMutation({ mutationFn: searchGyms });
}

/**
 * The server checks the pick against the OpenStreetMap API (it must be a real
 * leisure=fitness_centre) and stores it; only then can it become one of the player's gyms.
 */
export async function resolveGym(gym: FoundGym): Promise<string> {
  if (gym.id) return gym.id;
  const { data, error } = await db().functions.invoke<{ gym: { id: string } }>('search-gyms', {
    body: { mode: 'resolve', osm_id: gym.osm_id },
  });
  if (error) throw new Error((await functionErrorCode(error)) ?? 'gym_search_unavailable');
  if (!data?.gym?.id) throw new Error('gym_not_found');
  return data.gym.id;
}
