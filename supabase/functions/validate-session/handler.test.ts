import assert from 'node:assert/strict';

import { HttpError } from '../_shared/http.ts';
import type { PushMessage } from '../_shared/push.ts';
import {
  createHandler,
  plateLoadedMessage,
  type SessionGateway,
  type Validation,
} from './handler.ts';

const GYM = '11111111-1111-4111-8111-111111111111';
const validation: Validation = {
  session_id: 's1',
  validated_at: '2026-11-04T18:00:00Z',
  duration_min: 52,
  week_start: '2026-11-02',
  done_this_week: 3,
  goal: 3,
  lifetime_sessions: 35,
};

function setup(opts: { validateError?: string; demoUsers?: string[]; pushFails?: boolean } = {}) {
  const calls: { validate: unknown[][]; pushed: PushMessage[][]; deleted: string[][] } = {
    validate: [],
    pushed: [],
    deleted: [],
  };
  const sessions: SessionGateway = {
    validate: (...args) => {
      calls.validate.push(args);
      return opts.validateError
        ? Promise.reject(new Error(opts.validateError))
        : Promise.resolve(validation);
    },
    pseudo: () => Promise.resolve('Sofiane'),
    teammateTargets: () =>
      Promise.resolve([
        { user_id: 'u2', token: 'ExponentPushToken[a]', team_id: 't1' },
        { user_id: 'u3', token: 'ExponentPushToken[dead]', team_id: 't1' },
      ]),
    deleteTokens: (tokens) => {
      calls.deleted.push(tokens);
      return Promise.resolve();
    },
  };
  const handler = createHandler({
    authenticate: (req) =>
      req.headers.get('Authorization')
        ? Promise.resolve({ id: 'me' })
        : Promise.reject(new HttpError(401, 'not_authenticated')),
    sessions,
    push: (messages) => {
      calls.pushed.push(messages);
      if (opts.pushFails) return Promise.reject(new Error('expo down'));
      return Promise.resolve({ sent: 1, invalidTokens: ['ExponentPushToken[dead]'] });
    },
    demoUserIds: new Set(opts.demoUsers ?? []),
  });
  return { handler, calls };
}

function post(body: unknown, auth = true) {
  return new Request('http://localhost/validate-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer jwt' } : {}),
    },
    body: JSON.stringify(body),
  });
}

const body = {
  gym_id: GYM,
  ended_at: '2026-11-04T18:00:00+01:00',
  started_at: '2026-11-04T17:05:00+01:00',
  duration_min: 55,
};

Deno.test('requires authentication', async () => {
  const { handler } = setup();
  assert.equal((await handler(post(body, false))).status, 401);
});

Deno.test('rejects coordinates and malformed payloads', async () => {
  const { handler, calls } = setup();
  for (const bad of [
    { ...body, lat: 50.63, lng: 3.06 },
    { ...body, gym_id: 'not-a-uuid' },
    { ...body, ended_at: 'yesterday' },
    { gym_id: GYM },
  ]) {
    assert.equal((await handler(post(bad))).status, 400, JSON.stringify(bad));
  }
  assert.equal(calls.validate.length, 0);
});

Deno.test('validates with the caller id and notifies teammates', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(body));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual(json.session, validation);
  assert.equal(json.notified, 1);
  assert.deepEqual(calls.validate[0], ['me', GYM, body.ended_at, false]);
  assert.equal(calls.pushed[0].length, 2);
  assert.equal(calls.pushed[0][0].body, 'Sofiane vient de charger 20 kg 💪');
  assert.deepEqual(calls.pushed[0][0].data, { type: 'plate_loaded', team_id: 't1' });
  assert.deepEqual(calls.deleted, [['ExponentPushToken[dead]']]);
});

Deno.test('a push failure never undoes a validation', async () => {
  const { handler } = setup({ pushFails: true });
  const res = await handler(post(body));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).notified, 0);
});

Deno.test('database refusals map to stable codes', async () => {
  for (const [message, status] of [
    ['session_too_short', 422],
    ['no_open_session', 409],
    ['already_validated_today', 409],
    ['gym_mismatch', 403],
    ['invalid_ended_at', 400],
  ] as const) {
    const { handler, calls } = setup({ validateError: message });
    const res = await handler(post(body));
    assert.equal(res.status, status, message);
    assert.deepEqual(await res.json(), { error: message });
    assert.equal(calls.pushed.length, 0);
  }
});

Deno.test('demo sessions only for allow-listed developers', async () => {
  const refused = setup();
  const res = await refused.handler(post({ ...body, demo: true }));
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'demo_not_allowed' });

  const allowed = setup({ demoUsers: ['me'] });
  assert.equal((await allowed.handler(post({ ...body, demo: true }))).status, 200);
  assert.equal(allowed.calls.validate[0][3], true);
});

Deno.test('message falls back when the pseudo is missing', () => {
  assert.equal(plateLoadedMessage(null), 'Un pote vient de charger 20 kg 💪');
});
