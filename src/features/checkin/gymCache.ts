import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GymPoint } from '@/domain/checkin';

/**
 * The player's own gyms (public OSM places), cached so background tasks can check
 * presence without a network round trip.
 */
const KEY = 'noskip.checkin.gyms.v1';

export async function readGymCache(): Promise<GymPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GymPoint[]) : [];
  } catch {
    return [];
  }
}

export const writeGymCache = (gyms: GymPoint[]) => AsyncStorage.setItem(KEY, JSON.stringify(gyms));
