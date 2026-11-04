import AsyncStorage from '@react-native-async-storage/async-storage';

import { apply, arrive, leave, resume } from '../engine';
import { readLastResult, readVisit } from '../storage';

const mockRpc = jest.fn();
const mockInvoke = jest.fn();
const mockLastKnown = jest.fn();

jest.mock('@/lib/supabase', () => ({
  db: () => ({ rpc: mockRpc, functions: { invoke: mockInvoke } }),
}));
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getLastKnownPositionAsync: (...args: unknown[]) => mockLastKnown(...args),
  getCurrentPositionAsync: jest.fn(),
}));

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 4, 17, 0);
const gym = { id: 'gym-1', lat: 50.63, lng: 3.06 };
const validated = {
  session_id: 's1',
  duration_min: 47,
  done_this_week: 2,
  goal: 3,
  lifetime_sessions: 12,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  mockRpc.mockReset().mockResolvedValue({ data: null, error: null });
  mockInvoke.mockReset().mockResolvedValue({ data: { session: validated }, error: null });
  mockLastKnown.mockReset().mockResolvedValue(null);
});

describe('check-in engine', () => {
  it('opens the session on the server at arrival', async () => {
    const visit = await arrive('gym-1', T0, 'geofence');
    expect(visit.serverOpened).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('start_session', {
      p_gym_id: 'gym-1',
      p_started_at: new Date(T0).toISOString(),
      p_source: 'geofence',
    });
  });

  it('ignores geofence events when the OS reports a mocked position', async () => {
    mockLastKnown.mockResolvedValue({
      coords: { latitude: 50.63, longitude: 3.06, accuracy: 5 },
      mocked: true,
    });
    await expect(arrive('gym-1', T0, 'geofence')).rejects.toThrow('mocked_location');
    expect(await readVisit()).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('keeps the visit locally when offline, and opens it on resume', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('Network request failed') });
    const visit = await arrive('gym-1', T0, 'geofence');
    expect(visit.serverOpened).toBe(false);
    await resume([gym], T0 + 10 * MIN, () =>
      Promise.resolve({ lat: 50.63, lng: 3.06, accuracy: 10 }),
    );
    expect((await readVisit())?.serverOpened).toBe(true);
  });

  it('validates on exit after 40 min and sends no coordinates', async () => {
    await arrive('gym-1', T0, 'geofence');
    const result = await leave('gym-1', T0 + 47 * MIN);
    expect(result).toEqual(validated);
    const body = mockInvoke.mock.calls[0][1].body;
    expect(body).toEqual({
      gym_id: 'gym-1',
      started_at: new Date(T0).toISOString(),
      ended_at: new Date(T0 + 47 * MIN).toISOString(),
      duration_min: 47,
    });
    expect(JSON.stringify(body)).not.toMatch(/lat|lng|longitude|latitude|coords/);
    expect(await readVisit()).toBeNull();
    expect(await readLastResult()).toMatchObject({
      kind: 'validated',
      doneThisWeek: 2,
      seen: false,
    });
  });

  it('cancels a short visit', async () => {
    await arrive('gym-1', T0, 'geofence');
    expect(await leave('gym-1', T0 + 20 * MIN)).toBeNull();
    expect(mockRpc).toHaveBeenLastCalledWith('cancel_session');
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(await readVisit()).toBeNull();
  });

  it('records a server refusal and ends the visit', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'session_too_short' })) },
    });
    await arrive('gym-1', T0, 'geofence');
    await expect(leave('gym-1', T0 + 45 * MIN)).rejects.toThrow('session_too_short');
    expect(await readVisit()).toBeNull();
    expect(await readLastResult()).toMatchObject({ kind: 'refused', code: 'session_too_short' });
  });

  it('keeps the visit for a retry on network errors', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Network request failed') });
    await arrive('gym-1', T0, 'geofence');
    await expect(leave('gym-1', T0 + 45 * MIN)).rejects.toThrow('network');
    expect(await readVisit()).not.toBeNull();
  });

  it('resume validates only if still inside', async () => {
    await arrive('gym-1', T0, 'geofence');
    const outside = () => Promise.resolve({ lat: 50.7, lng: 3.06, accuracy: 10 });
    expect(await resume([gym], T0 + 50 * MIN, outside)).toBeNull();
    expect(await readVisit()).toBeNull();

    await arrive('gym-1', T0, 'geofence');
    const inside = () => Promise.resolve({ lat: 50.6301, lng: 3.06, accuracy: 10 });
    expect(await resume([gym], T0 + 50 * MIN, inside)).toEqual(validated);
  });

  it('passes the demo flag through only when asked', async () => {
    await apply(
      { kind: 'validate', gymId: 'gym-1', startedAt: T0, endedAt: T0 + 45 * MIN, durationMin: 45 },
      { demo: true },
    );
    expect(mockInvoke.mock.calls[0][1].body.demo).toBe(true);
  });
});
