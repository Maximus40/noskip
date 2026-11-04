/**
 * Gym check-in rules, pure and deterministic (times are epoch milliseconds).
 * The phone decides presence; the server re-checks the 40 minutes with its own clock.
 */
import { distanceMeters } from './geo';

export const GEOFENCE_RADIUS_M = 150;
export const MIN_SESSION_MIN = 40;
export const MIN_SESSION_MS = MIN_SESSION_MIN * 60_000;
/** The progress ring on "Séance en cours" fills up at 45:00. */
export const RING_TARGET_MS = 45 * 60_000;
/** A visit older than this is stale (phone off, forgotten state): never validate it. */
export const MAX_VISIT_MS = 18 * 3600_000;
/** GPS fixes worse than this cannot prove anything. */
export const MAX_ACCURACY_M = 200;

export type CheckinSource = 'geofence' | 'manual_check';

export type Visit = {
  gymId: string;
  enteredAt: number;
  source: CheckinSource;
  /** true once start_session reached the server (its clock is what counts). */
  serverOpened: boolean;
};

export type Fix = { lat: number; lng: number; accuracy: number | null; mocked?: boolean };
export type GymPoint = { id: string; lat: number; lng: number };

export type Decision =
  | { kind: 'validate'; gymId: string; startedAt: number; endedAt: number; durationMin: number }
  | { kind: 'cancel'; reason: 'too_short' | 'left_unseen' | 'stale' }
  | { kind: 'keep' }
  | { kind: 'none' };

export function elapsedMs(visit: Visit, now: number): number {
  return Math.max(0, now - visit.enteredAt);
}

export function durationMin(visit: Visit, endedAt: number): number {
  return Math.floor(elapsedMs(visit, endedAt) / 60_000);
}

/** A geofence "enter". A repeated enter for the same gym keeps the original arrival time. */
export function onEnter(
  current: Visit | null,
  gymId: string,
  now: number,
  source: CheckinSource = 'geofence',
): Visit {
  if (current && current.gymId === gymId && now - current.enteredAt < MAX_VISIT_MS) return current;
  return { gymId, enteredAt: now, source, serverOpened: false };
}

/** A geofence "exit": validate if the stay was long enough, otherwise drop it. */
export function onExit(current: Visit | null, gymId: string, now: number): Decision {
  if (!current || current.gymId !== gymId) return { kind: 'none' };
  if (now - current.enteredAt >= MAX_VISIT_MS) return { kind: 'cancel', reason: 'stale' };
  const minutes = durationMin(current, now);
  if (minutes < MIN_SESSION_MIN) return { kind: 'cancel', reason: 'too_short' };
  return {
    kind: 'validate',
    gymId,
    startedAt: current.enteredAt,
    endedAt: now,
    durationMin: minutes,
  };
}

/**
 * App reopened (or background check) without an exit event: validate only if the player is
 * still inside and 40 minutes passed. If they are gone we cannot know when they left: drop it.
 */
export function onResume(current: Visit | null, now: number, insideNow: boolean): Decision {
  if (!current) return { kind: 'none' };
  if (now - current.enteredAt >= MAX_VISIT_MS) return { kind: 'cancel', reason: 'stale' };
  if (!insideNow) return { kind: 'cancel', reason: 'left_unseen' };
  const minutes = durationMin(current, now);
  if (minutes < MIN_SESSION_MIN) return { kind: 'keep' };
  return {
    kind: 'validate',
    gymId: current.gymId,
    startedAt: current.enteredAt,
    endedAt: now,
    durationMin: minutes,
  };
}

export type FixVerdict = 'inside' | 'outside' | 'mocked' | 'imprecise';

/** Is this GPS fix proof of being at the gym? Mocked positions never count (anti-cheat). */
export function judgeFix(fix: Fix, gym: GymPoint): FixVerdict {
  if (fix.mocked) return 'mocked';
  if (fix.accuracy !== null && fix.accuracy > MAX_ACCURACY_M) return 'imprecise';
  const d = distanceMeters(fix.lat, fix.lng, gym.lat, gym.lng);
  // Give the benefit of the doubt up to 50 m of reported inaccuracy.
  const slack = Math.min(fix.accuracy ?? 0, 50);
  return d - slack <= GEOFENCE_RADIUS_M ? 'inside' : 'outside';
}

/** Gym of the list the fix falls into, if any (players have at most 3 gyms). */
export function gymAt(fix: Fix, gyms: GymPoint[]): GymPoint | null {
  return gyms.find((g) => judgeFix(fix, g) === 'inside') ?? null;
}

/** Remaining time before a manual session can be validated. */
export function remainingMs(visit: Visit, now: number): number {
  return Math.max(0, MIN_SESSION_MS - elapsedMs(visit, now));
}

/** "38:12" (mm:ss), "1:05:09" past an hour. */
export function formatChrono(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 0..1 fill of the progress ring. */
export function ringProgress(visit: Visit, now: number): number {
  return Math.min(1, elapsedMs(visit, now) / RING_TARGET_MS);
}

/** Geofence regions for the player's gyms (identifier = gym id). */
export function regionsFor(gyms: GymPoint[]) {
  return gyms.slice(0, 3).map((g) => ({
    identifier: g.id,
    latitude: g.lat,
    longitude: g.lng,
    radius: GEOFENCE_RADIUS_M,
    notifyOnEnter: true,
    notifyOnExit: true,
  }));
}
