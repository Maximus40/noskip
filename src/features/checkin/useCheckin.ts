import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import {
  type GymPoint,
  judgeFix,
  gymAt,
  MIN_SESSION_MS,
  onResume,
  type Visit,
} from '@/domain/checkin';
import { useMyGyms } from '@/features/profile/api';

import { apply, arrive, currentFix, resume } from './engine';
import { clearVisit, readLastResult, readVisit, writeLastResult } from './storage';
import { syncGeofences } from './tasks';

export const visitKey = ['checkin-visit'] as const;

export function useVisit() {
  return useQuery({ queryKey: visitKey, queryFn: readVisit, staleTime: 0 });
}

/** The player's gyms as plain points (public OSM places). */
export function useGymPoints(): {
  gyms: GymPoint[];
  names: Record<string, string>;
  loading: boolean;
} {
  const myGyms = useMyGyms();
  return useMemo(() => {
    const gyms: GymPoint[] = [];
    const names: Record<string, string> = {};
    for (const row of myGyms.data ?? []) {
      const g = row.gym as unknown as { id: string; name: string; lat: number; lng: number } | null;
      if (!g) continue;
      gyms.push({ id: g.id, lat: g.lat, lng: g.lng });
      names[g.id] = g.name;
    }
    return { gyms, names, loading: myGyms.isLoading };
  }, [myGyms.data, myGyms.isLoading]);
}

function useRefreshAfterCheckin() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: visitKey }),
        queryClient.invalidateQueries({ queryKey: ['team-board'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ]),
    [queryClient],
  );
}

/** Shows the "Disque chargé" moment once for each new validation (also those done in background). */
async function showUnseenResult() {
  const last = await readLastResult();
  if (!last || last.seen) return;
  await writeLastResult({ ...last, seen: true });
  if (last.kind === 'validated') {
    router.push({
      pathname: '/plate-loaded',
      params: {
        duration: String(last.durationMin),
        done: String(last.doneThisWeek),
        goal: String(last.goal),
        lifetime: String(last.lifetimeSessions),
      },
    });
  }
}

/**
 * Mounted once in the signed-in app: keeps geofences in sync with the player's gyms and
 * re-checks an open visit whenever the app comes back to the foreground.
 */
export function useCheckinLifecycle() {
  const { gyms, loading } = useGymPoints();
  const refresh = useRefreshAfterCheckin();
  const busy = useRef(false);

  useEffect(() => {
    if (loading) return;
    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        await syncGeofences(gyms).catch(() => undefined);
        await resume(gyms, Date.now()).catch(() => undefined);
        await refresh();
        await showUnseenResult();
      } finally {
        busy.current = false;
      }
    };
    tick();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => sub.remove();
  }, [gyms, loading, refresh]);
}

export type CheckinError =
  | 'location_denied'
  | 'not_at_gym'
  | 'mocked_location'
  | 'imprecise_location'
  | 'too_early'
  | 'no_visit';

function checkinFailure(code: CheckinError): Error {
  return new Error(code);
}

async function foregroundFix() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw checkinFailure('location_denied');
  return currentFix();
}

/** Plan B and in-session actions for the "Séance en cours" screen. */
export function useCheckinActions() {
  const { gyms } = useGymPoints();
  const refresh = useRefreshAfterCheckin();

  /** "Je suis à la salle": first foreground check. */
  const checkIn = useCallback(async (): Promise<Visit> => {
    const fix = await foregroundFix();
    if (fix.mocked) throw checkinFailure('mocked_location');
    const gym = gymAt(fix, gyms);
    if (!gym) {
      const imprecise = gyms.some((g) => judgeFix(fix, g) === 'imprecise');
      throw checkinFailure(imprecise ? 'imprecise_location' : 'not_at_gym');
    }
    const visit = await arrive(gym.id, Date.now(), 'manual_check');
    await refresh();
    return visit;
  }, [gyms, refresh]);

  /** Second check, at least 40 minutes later: still inside → validate. */
  const finish = useCallback(async () => {
    const visit = await readVisit();
    if (!visit) throw checkinFailure('no_visit');
    if (Date.now() - visit.enteredAt < MIN_SESSION_MS) throw checkinFailure('too_early');
    const fix = await foregroundFix();
    const gym = gyms.find((g) => g.id === visit.gymId);
    const verdict = gym ? judgeFix(fix, gym) : 'outside';
    if (verdict === 'mocked') throw checkinFailure('mocked_location');
    if (verdict === 'imprecise') throw checkinFailure('imprecise_location');
    if (verdict === 'outside') throw checkinFailure('not_at_gym');
    const result = await apply(onResume(visit, Date.now(), true));
    await refresh();
    await showUnseenResult();
    return result;
  }, [gyms, refresh]);

  const abandon = useCallback(async () => {
    await apply({ kind: 'cancel', reason: 'too_short' });
    await clearVisit();
    await refresh();
  }, [refresh]);

  return { checkIn, finish, abandon };
}

export { showUnseenResult };
