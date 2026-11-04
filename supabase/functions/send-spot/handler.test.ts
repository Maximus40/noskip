import assert from 'node:assert/strict';

import { HttpError } from '../_shared/http.ts';
import type { PushMessage } from '../_shared/push.ts';
import { createHandler, type SpotGateway, spotMessage } from './handler.ts';

const TO = '22222222-2222-4222-8222-222222222222';
const TEAM = '33333333-3333-4333-8333-333333333333';

function setup(sendError?: string) {
  const calls = {
    send: [] as string[][],
    pushed: [] as PushMessage[][],
    deleted: [] as string[][],
  };
  const spots: SpotGateway = {
    send: (from, to, team) => {
      calls.send.push([from, to, team]);
      return sendError
        ? Promise.reject(new Error(sendError))
        : Promise.resolve({ spot_id: 's1', sent_today: 2, from_pseudo: 'Karim' });
    },
    targets: () => Promise.resolve(['ExponentPushToken[k]', 'ExponentPushToken[dead]']),
    deleteTokens: (t) => {
      calls.deleted.push(t);
      return Promise.resolve();
    },
  };
  const handler = createHandler({
    authenticate: (req) =>
      req.headers.get('Authorization')
        ? Promise.resolve({ id: 'me' })
        : Promise.reject(new HttpError(401, 'not_authenticated')),
    spots,
    push: (m) => {
      calls.pushed.push(m);
      return Promise.resolve({ sent: 1, invalidTokens: ['ExponentPushToken[dead]'] });
    },
  });
  return { handler, calls };
}

const post = (body: unknown, auth = true) =>
  new Request('http://localhost/send-spot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer x' } : {}) },
    body: JSON.stringify(body),
  });

Deno.test('requires auth and a valid body', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(post({ to_user: TO, team_id: TEAM }, false))).status, 401);
  assert.equal((await handler(post({ to_user: 'x', team_id: TEAM }))).status, 400);
  assert.equal((await handler(post({ to_user: TO, team_id: TEAM, from_user: TO }))).status, 400);
  assert.equal(calls.send.length, 0);
});

Deno.test('spots with the caller id and pushes the French message', async () => {
  const { handler, calls } = setup();
  const res = await handler(post({ to_user: TO, team_id: TEAM }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { sent_today: 2, remaining_today: 1, delivered: 1 });
  assert.deepEqual(calls.send[0], ['me', TO, TEAM]);
  assert.equal(calls.pushed[0][0].body, 'Karim te spot : bouge à la salle !');
  assert.deepEqual(calls.deleted, [['ExponentPushToken[dead]']]);
});

Deno.test('limits map to stable codes', async () => {
  for (const [message, status] of [
    ['spot_daily_limit', 429],
    ['already_spotted_today', 409],
    ['already_trained_today', 409],
    ['player_has_joker', 409],
    ['not_a_member', 403],
    ['cannot_spot_self', 400],
  ] as const) {
    const { handler, calls } = setup(message);
    const res = await handler(post({ to_user: TO, team_id: TEAM }));
    assert.equal(res.status, status, message);
    assert.equal(calls.pushed.length, 0);
  }
});

Deno.test('message fallback', () => {
  assert.equal(spotMessage(null), 'Un pote te spot : bouge à la salle !');
});
