import {
  durationMin,
  formatChrono,
  GEOFENCE_RADIUS_M,
  gymAt,
  judgeFix,
  MAX_VISIT_MS,
  onEnter,
  onExit,
  onResume,
  regionsFor,
  remainingMs,
  ringProgress,
  type Visit,
} from './checkin';

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 4, 17, 0);
const gym = { id: 'g1', lat: 50.63, lng: 3.06 };
const visit: Visit = { gymId: 'g1', enteredAt: T0, source: 'geofence', serverOpened: true };

// ~0.0009° latitude ≈ 100 m
const near = { lat: 50.6309, lng: 3.06, accuracy: 20 };
const far = { lat: 50.64, lng: 3.06, accuracy: 20 };

describe('geofence events', () => {
  it('starts a visit on enter and keeps the first arrival on repeated enters', () => {
    const v = onEnter(null, 'g1', T0);
    expect(v).toEqual({ gymId: 'g1', enteredAt: T0, source: 'geofence', serverOpened: false });
    expect(onEnter(v, 'g1', T0 + 10 * MIN)).toBe(v);
    expect(onEnter(v, 'g2', T0 + 10 * MIN).gymId).toBe('g2');
    expect(onEnter(v, 'g1', T0 + MAX_VISIT_MS).enteredAt).toBe(T0 + MAX_VISIT_MS);
    expect(onEnter(null, 'g1', T0, 'manual_check').source).toBe('manual_check');
  });

  it('validates on exit after 40 minutes, cancels before', () => {
    expect(onExit(visit, 'g1', T0 + 39 * MIN + 59_000)).toEqual({
      kind: 'cancel',
      reason: 'too_short',
    });
    expect(onExit(visit, 'g1', T0 + 52 * MIN + 10_000)).toEqual({
      kind: 'validate',
      gymId: 'g1',
      startedAt: T0,
      endedAt: T0 + 52 * MIN + 10_000,
      durationMin: 52,
    });
  });

  it('ignores exits that do not match the visit and drops stale visits', () => {
    expect(onExit(null, 'g1', T0)).toEqual({ kind: 'none' });
    expect(onExit(visit, 'g2', T0 + 60 * MIN)).toEqual({ kind: 'none' });
    expect(onExit(visit, 'g1', T0 + MAX_VISIT_MS)).toEqual({ kind: 'cancel', reason: 'stale' });
  });
});

describe('resume without an exit event (app killed)', () => {
  it('validates only when still inside after 40 minutes', () => {
    expect(onResume(null, T0, true)).toEqual({ kind: 'none' });
    expect(onResume(visit, T0 + 20 * MIN, true)).toEqual({ kind: 'keep' });
    expect(onResume(visit, T0 + 45 * MIN, true)).toMatchObject({
      kind: 'validate',
      durationMin: 45,
    });
    expect(onResume(visit, T0 + 45 * MIN, false)).toEqual({
      kind: 'cancel',
      reason: 'left_unseen',
    });
    expect(onResume(visit, T0 + MAX_VISIT_MS, true)).toEqual({ kind: 'cancel', reason: 'stale' });
  });
});

describe('GPS fixes', () => {
  it('accepts fixes inside the 150 m circle', () => {
    expect(GEOFENCE_RADIUS_M).toBe(150);
    expect(judgeFix(near, gym)).toBe('inside');
    expect(judgeFix(far, gym)).toBe('outside');
  });

  it('gives up to 50 m of slack for inaccuracy, not more', () => {
    const at190m = { lat: 50.63171, lng: 3.06 };
    expect(judgeFix({ ...at190m, accuracy: 5 }, gym)).toBe('outside');
    expect(judgeFix({ ...at190m, accuracy: 45 }, gym)).toBe('inside');
    const at230m = { lat: 50.63207, lng: 3.06 };
    expect(judgeFix({ ...at230m, accuracy: 150 }, gym)).toBe('outside');
    expect(judgeFix({ ...near, accuracy: null }, gym)).toBe('inside');
  });

  it('rejects mocked and imprecise fixes (anti-cheat)', () => {
    expect(judgeFix({ ...near, mocked: true }, gym)).toBe('mocked');
    expect(judgeFix({ ...near, accuracy: 500 }, gym)).toBe('imprecise');
  });

  it('finds the gym a fix belongs to', () => {
    const other = { id: 'g2', lat: 50.64, lng: 3.06 };
    expect(gymAt(far, [gym, other])).toBe(other);
    expect(gymAt({ lat: 48.85, lng: 2.35, accuracy: 10 }, [gym, other])).toBeNull();
  });
});

describe('chrono and ring', () => {
  it('formats elapsed time', () => {
    expect(formatChrono(0)).toBe('00:00');
    expect(formatChrono((38 * 60 + 12) * 1000)).toBe('38:12');
    expect(formatChrono((65 * 60 + 9) * 1000)).toBe('1:05:09');
    expect(formatChrono(-5)).toBe('00:00');
  });

  it('fills the ring towards 45:00 and counts down to 40', () => {
    expect(ringProgress(visit, T0 + 22.5 * MIN)).toBeCloseTo(0.5);
    expect(ringProgress(visit, T0 + 90 * MIN)).toBe(1);
    expect(remainingMs(visit, T0 + 30 * MIN)).toBe(10 * MIN);
    expect(remainingMs(visit, T0 + 50 * MIN)).toBe(0);
    expect(durationMin(visit, T0 - MIN)).toBe(0);
  });
});

describe('regions', () => {
  it('builds at most 3 regions of 150 m keyed by gym id', () => {
    const gyms = ['a', 'b', 'c', 'd'].map((id) => ({ id, lat: 1, lng: 2 }));
    const regions = regionsFor(gyms);
    expect(regions).toHaveLength(3);
    expect(regions[0]).toEqual({
      identifier: 'a',
      latitude: 1,
      longitude: 2,
      radius: 150,
      notifyOnEnter: true,
      notifyOnExit: true,
    });
  });
});
