/**
 * Check-in engine shared by the geofence task, the background task and the foreground app.
 * Pure decisions live in src/domain/checkin.ts; this file performs the side effects.
 * Only gym ids and timestamps are sent to the server, never coordinates.
 */
import * as Location from 'expo-location';

import {
  type CheckinSource,
  type Decision,
  type Fix,
  type GymPoint,
  judgeFix,
  onEnter,
  onExit,
  onResume,
  type Visit,
} from '@/domain/checkin';
import { functionErrorCode } from '@/lib/errors';
import { db } from '@/lib/supabase';

import { clearVisit, readVisit, writeLastResult, writeVisit } from './storage';

export type Validated = {
  session_id: string;
  duration_min: number;
  done_this_week: number;
  goal: number;
  lifetime_sessions: number;
};

/** Current position as a Fix. Stays on the phone. */
export async function currentFix(): Promise<Fix> {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
    mocked: pos.mocked === true,
  };
}

/** Last known position if fresh enough, used to screen geofence events for mock locations. */
async function recentFix(): Promise<Fix | null> {
  try {
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000 });
    if (!pos) return null;
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
      mocked: pos.mocked === true,
    };
  } catch {
    return null;
  }
}

async function openOnServer(visit: Visit): Promise<Visit> {
  const { error } = await db().rpc('start_session', {
    p_gym_id: visit.gymId,
    p_started_at: new Date(visit.enteredAt).toISOString(),
    p_source: visit.source,
  });
  if (error) throw error;
  const opened = { ...visit, serverOpened: true };
  await writeVisit(opened);
  return opened;
}

/** Arrival at a gym (geofence enter, or the manual "Je suis à la salle" check). */
export async function arrive(gymId: string, now: number, source: CheckinSource): Promise<Visit> {
  if (source === 'geofence') {
    const fix = await recentFix();
    // Android mock providers / iOS simulated locations: ignore the event entirely.
    if (fix?.mocked) throw new Error('mocked_location');
  }
  const current = await readVisit();
  const visit = onEnter(current, gymId, now, source);
  await writeVisit(visit);
  if (visit.serverOpened) return visit;
  try {
    return await openOnServer(visit);
  } catch {
    // Offline: kept locally, retried on the next resume.
    return visit;
  }
}

async function validateOnServer(
  decision: Extract<Decision, { kind: 'validate' }>,
  demo: boolean,
): Promise<Validated> {
  // Exactly what the spec allows to leave the phone: gym_id, started_at, ended_at, duration_min.
  const body = {
    gym_id: decision.gymId,
    started_at: new Date(decision.startedAt).toISOString(),
    ended_at: new Date(decision.endedAt).toISOString(),
    duration_min: decision.durationMin,
    ...(demo ? { demo: true } : {}),
  };
  const { data, error } = await db().functions.invoke<{ session: Validated }>('validate-session', {
    body,
  });
  if (error) throw new Error((await functionErrorCode(error)) ?? 'validation_failed');
  if (!data) throw new Error('validation_failed');
  return data.session;
}

/** Applies a decision: validate, cancel or nothing. Records the outcome for the UI. */
export async function apply(
  decision: Decision,
  opts: { demo?: boolean } = {},
): Promise<Validated | null> {
  if (decision.kind === 'keep' || decision.kind === 'none') return null;
  if (decision.kind === 'cancel') {
    await clearVisit();
    try {
      await db().rpc('cancel_session');
    } catch {
      // Nothing to cancel server-side is fine.
    }
    return null;
  }
  try {
    const session = await validateOnServer(decision, opts.demo ?? false);
    await clearVisit();
    await writeLastResult({
      kind: 'validated',
      at: decision.endedAt,
      gymId: decision.gymId,
      durationMin: session.duration_min,
      doneThisWeek: session.done_this_week,
      goal: session.goal,
      lifetimeSessions: session.lifetime_sessions,
      seen: false,
    });
    return session;
  } catch (err) {
    const code = err instanceof Error ? err.message : 'validation_failed';
    // Definitive refusals end the visit; network errors keep it for a retry.
    if (code !== 'network' && code !== 'validation_failed') {
      await clearVisit();
      await writeLastResult({ kind: 'refused', at: decision.endedAt, code, seen: false });
    }
    throw err;
  }
}

/** Geofence exit. */
export async function leave(gymId: string, now: number): Promise<Validated | null> {
  return apply(onExit(await readVisit(), gymId, now));
}

/**
 * Re-checks an open visit without an exit event (app reopened, background task).
 * Opens it on the server if that failed earlier, then validates if still inside after 40 min.
 */
export async function resume(
  gyms: GymPoint[],
  now: number,
  getFix: () => Promise<Fix> = currentFix,
) {
  let visit = await readVisit();
  if (!visit) return null;
  if (!visit.serverOpened) {
    try {
      visit = await openOnServer(visit);
    } catch {
      return null;
    }
  }
  const gym = gyms.find((g) => g.id === visit!.gymId);
  if (!gym) return apply({ kind: 'cancel', reason: 'left_unseen' });
  let inside = false;
  try {
    inside = judgeFix(await getFix(), gym) === 'inside';
  } catch {
    return null; // No fix: decide later.
  }
  return apply(onResume(visit, now, inside));
}
