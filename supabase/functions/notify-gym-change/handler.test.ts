import assert from 'node:assert/strict';

import { cronAuthorizer } from '../_shared/cron.ts';
import type { PushMessage } from '../_shared/push.ts';
import { createHandler, gymChangeMessage } from './handler.ts';

const SECRET = 'g'.repeat(40);
const USER = '11111111-1111-4111-8111-111111111111';
const AT = '2026-11-09T10:00:00.000Z';

function setup(changedAt: string | null = AT) {
  const pushed: PushMessage[][] = [];
  const handler = createHandler({
    authorize: cronAuthorizer((s) => Promise.resolve(s === SECRET)),
    store: {
      info: () => Promise.resolve({ pseudo: 'Karim', changed_at: changedAt }),
      teammateTargets: () => Promise.resolve([{ token: 'tok-1', team_id: 't1' }]),
      deleteTokens: () => Promise.resolve(),
    },
    push: (m) => {
      pushed.push(m);
      return Promise.resolve({ sent: m.length, invalidTokens: [] });
    },
  });
  return { handler, pushed };
}

const post = (body: unknown, secret: string | null = SECRET) =>
  new Request('http://localhost/notify-gym-change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-cron-secret': secret } : {}) },
    body: JSON.stringify(body),
  });

Deno.test('only the database trigger (shared secret) can call it', async () => {
  const { handler, pushed } = setup();
  assert.equal((await handler(post({ user_id: USER, changed_at: AT }, null))).status, 401);
  assert.equal((await handler(post({ user_id: 'x', changed_at: AT }))).status, 400);
  assert.equal(pushed.length, 0);
});

Deno.test('tells teammates, without naming the gym', async () => {
  const { handler, pushed } = setup();
  const res = await handler(post({ user_id: USER, changed_at: '2026-11-09T10:00:00+00:00' }));
  assert.deepEqual(await res.json(), { sent: 1 });
  assert.equal(
    pushed[0][0].body,
    'Karim a changé de salle principale. Prochain changement possible dans 30 jours.',
  );
  assert.deepEqual(pushed[0][0].data, { type: 'gym_change', user_id: USER, team_id: 't1' });
});

Deno.test('a stale call does nothing', async () => {
  const { handler, pushed } = setup('2026-12-01T10:00:00.000Z');
  assert.deepEqual(await (await handler(post({ user_id: USER, changed_at: AT }))).json(), {
    sent: 0,
    skipped: 'stale',
  });
  assert.equal(pushed.length, 0);
  assert.equal(gymChangeMessage(null).startsWith('Un pote'), true);
});
