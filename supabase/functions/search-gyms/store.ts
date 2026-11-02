import type { SupabaseClient } from '@supabase/supabase-js';

import type { GymRow, GymStore } from './handler.ts';
import type { OsmGym } from './overpass.ts';

const COLUMNS = 'id, osm_id, name, lat, lng, address';

export function supabaseGymStore(db: SupabaseClient): GymStore {
  return {
    async getCached(key, maxAgeMs) {
      const { data, error } = await db
        .from('gym_search_cache')
        .select('gym_ids, created_at')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      if (!data || Date.now() - new Date(data.created_at).getTime() > maxAgeMs) return null;
      if (data.gym_ids.length === 0) return [];
      const gyms = await db.from('gyms').select(COLUMNS).in('id', data.gym_ids);
      if (gyms.error) throw gyms.error;
      return gyms.data as GymRow[];
    },
    async upsertGyms(gyms: OsmGym[]) {
      if (gyms.length === 0) return [];
      const { data, error } = await db
        .from('gyms')
        .upsert(
          gyms.map((g) => ({ ...g, updated_at: new Date().toISOString() })),
          { onConflict: 'osm_id' },
        )
        .select(COLUMNS);
      if (error) throw error;
      return data as GymRow[];
    },
    async putCache(key, gymIds) {
      const { error } = await db
        .from('gym_search_cache')
        .upsert({ key, gym_ids: gymIds, created_at: new Date().toISOString() });
      if (error) throw error;
    },
  };
}
