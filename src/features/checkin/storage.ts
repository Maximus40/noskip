import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Visit } from '@/domain/checkin';

/** Local, device-only state. Holds times and a gym id; never a position. */
const VISIT_KEY = 'noskip.checkin.visit.v1';
const RESULT_KEY = 'noskip.checkin.lastResult.v1';

export type CheckinResult =
  | {
      kind: 'validated';
      at: number;
      gymId: string;
      durationMin: number;
      doneThisWeek: number;
      goal: number;
      lifetimeSessions: number;
      seen: boolean;
    }
  | { kind: 'refused'; at: number; code: string; seen: boolean };

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const readVisit = () => readJson<Visit>(VISIT_KEY);
export const writeVisit = (visit: Visit) => AsyncStorage.setItem(VISIT_KEY, JSON.stringify(visit));
export const clearVisit = () => AsyncStorage.removeItem(VISIT_KEY);

export const readLastResult = () => readJson<CheckinResult>(RESULT_KEY);
export const writeLastResult = (result: CheckinResult) =>
  AsyncStorage.setItem(RESULT_KEY, JSON.stringify(result));
