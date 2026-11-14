import assert from 'node:assert/strict';

import { cronAuthorizer } from '../_shared/cron.ts';
import type { PushMessage } from '../_shared/push.ts';
import { createHandler } from './handler.ts';

const SECRET = 'o'.repeat(40);
const CAMPAIGN = '22222222-2222-4222-8222-222222222222';

function setup() {
  const pushed: PushMessage[][] = [];
  const deleted: string[][] = [];
  const sentCounts: number[] = [];
  let claimed = false;
  const handler = createHandler({
    authorize: cronAuthorizer((s) => Promise.resolve(s === SECRET)),
    store: {
      claim: () => {
        if (claimed) return Promise.resolve(null);
        claimed = true;
        return Promise.resolve({ title: 'Nouveau', body: '4 nouvelles cartes SKIP' });
      },
      targets: () => Promise.resolve(['tok-1', 'tok-2']),
      sent: (_id, n) => {
        sentCounts.push(n);
        return Promise.resolve();
      },
      deleteTokens: (t) => {
        deleted.push(t);
        return Promise.resolve();
      },
    },
    push: (m) => {
      pushed.push(m);
      return Promise.resolve({ sent: m.length - 1, invalidTokens: ['tok-2'] });
    },
  });
  return { handler, pushed, deleted, sentCounts };
}

const post = (body: unknown, secret: string | null = SECRET) =>
  new Request('http://localhost/send-offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-cron-secret': secret } : {}) },
    body: JSON.stringify(body),
  });

Deno.test('only the database (shared secret) can launch a campaign', async () => {
  const { handler, pushed } = setup();
  assert.equal((await handler(post({ campaign_id: CAMPAIGN }, null))).status, 401);
  assert.equal((await handler(post({ campaign_id: 'x' }))).status, 400);
  assert.equal(pushed.length, 0);
});

Deno.test('sends once to opted-in phones, opens the shop, cleans dead tokens', async () => {
  const { handler, pushed, deleted, sentCounts } = setup();
  const res = await handler(post({ campaign_id: CAMPAIGN }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { sent: 1 });
  assert.equal(pushed[0].length, 2);
  assert.equal(pushed[0][0].title, 'Nouveau');
  assert.deepEqual(pushed[0][0].data, { type: 'offer', campaign_id: CAMPAIGN });
  assert.deepEqual(deleted, [['tok-2']]);
  assert.deepEqual(sentCounts, [1]);

  const replay = await handler(post({ campaign_id: CAMPAIGN }));
  assert.deepEqual(await replay.json(), { sent: 0, skipped: 'already_sent' });
  assert.equal(pushed.length, 1);
});
