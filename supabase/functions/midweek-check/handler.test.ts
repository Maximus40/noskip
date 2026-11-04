import assert from 'node:assert/strict';

import { cronAuthorizer } from '../_shared/cron.ts';
import type { PushMessage } from '../_shared/push.ts';
import { createHandler, selfMessage, type ShakyStore, teammateMessage } from './handler.ts';

const SECRET = 'k'.repeat(40);

function setup() {
  const calls = {
    force: [] as boolean[],
    pushed: [] as PushMessage[][],
    deleted: [] as string[][],
  };
  const store: ShakyStore = {
    claim: (force) => {
      calls.force.push(force);
      return Promise.resolve([{ user_id: 'u1', pseudo: 'Karim', days_left: 2, missing: 2 }]);
    },
    selfTargets: () => Promise.resolve(['tok-self']),
    teammateTargets: () =>
      Promise.resolve([
        { token: 'tok-mate', team_id: 't1' },
        { token: 'tok-dead', team_id: 't1' },
      ]),
    deleteTokens: (t) => {
      calls.deleted.push(t);
      return Promise.resolve();
    },
  };
  const handler = createHandler({
    authorize: cronAuthorizer((s) => Promise.resolve(s === SECRET)),
    store,
    push: (m) => {
      calls.pushed.push(m);
      return Promise.resolve({ sent: 2, invalidTokens: ['tok-dead'] });
    },
  });
  return { handler, calls };
}

const post = (body: unknown, secret: string | null = SECRET) =>
  new Request('http://localhost/midweek-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-cron-secret': secret } : {}) },
    body: JSON.stringify(body),
  });

Deno.test('requires the cron secret and a strict body', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(post({}, null))).status, 401);
  assert.equal((await handler(post({ force: 'yes' }))).status, 400);
  assert.equal(calls.force.length, 0);
});

Deno.test('warns the player and their teammates, cleans dead tokens', async () => {
  const { handler, calls } = setup();
  const res = await handler(post({}));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { shaky: 1, sent: 2 });
  assert.deepEqual(calls.force, [false]);
  const msgs = calls.pushed[0];
  assert.equal(msgs.find((m) => m.to === 'tok-self')?.body, selfMessage(2, 2));
  assert.equal(msgs.find((m) => m.to === 'tok-mate')?.body, 'Karim risque le skip. Spotte-le !');
  assert.deepEqual(msgs.find((m) => m.to === 'tok-mate')?.data, {
    type: 'shaky',
    user_id: 'u1',
    team_id: 't1',
  });
  assert.deepEqual(calls.deleted, [['tok-dead']]);
});

Deno.test('French copy with plurals', () => {
  assert.equal(
    selfMessage(2, 2),
    "Il te reste 2 jours pour charger 2 disques. Le Canap' te chauffe déjà la place.",
  );
  assert.equal(
    selfMessage(1, 1),
    "Il te reste 1 jour pour charger 1 disque. Le Canap' te chauffe déjà la place.",
  );
  assert.equal(teammateMessage(null), 'Un pote risque le skip. Spotte-le !');
});
