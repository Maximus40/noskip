import { useMutation } from '@tanstack/react-query';

import { coarse } from '@/domain/geo';
import { functionErrorCode } from '@/lib/errors';
import { db } from '@/lib/supabase';

export type FoundGym = {
  id: string;
  osm_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
};

export type GymSearch =
  | { mode: 'near'; lat: number; lng: number }
  | { mode: 'name'; query: string; lat?: number; lng?: number };

/** Builds the request body: positions are rounded to ~1 km before leaving the phone. */
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

export async function searchGyms(search: GymSearch): Promise<FoundGym[]> {
  const { data, error } = await db().functions.invoke<{ gyms: FoundGym[] }>('search-gyms', {
    body: gymSearchBody(search),
  });
  if (error) throw new Error((await functionErrorCode(error)) ?? 'gym_search_unavailable');
  return data?.gyms ?? [];
}

export function useGymSearch() {
  return useMutation({ mutationFn: searchGyms });
}
