import assert from 'node:assert/strict';

import { EXPO_PUSH_URL, sendPush } from './push.ts';

Deno.test('sends in batches of 100 and collects unregistered tokens', async () => {
  const calls: { url: string; body: unknown[] }[] = [];
  const messages = Array.from({ length: 150 }, (_, i) => ({
    to: `ExponentPushToken[${i}]`,
    body: 'hi',
  }));
  const result = await sendPush((url, init) => {
    const body = JSON.parse(String(init?.body)) as { to: string }[];
    calls.push({ url, body });
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: body.map((m) =>
            m.to === 'ExponentPushToken[3]'
              ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
              : m.to === 'ExponentPushToken[4]'
                ? { status: 'error', details: { error: 'MessageRateExceeded' } }
                : { status: 'ok' },
          ),
        }),
      ),
    );
  }, messages);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, EXPO_PUSH_URL);
  assert.equal(calls[0].body.length, 100);
  assert.equal(calls[1].body.length, 50);
  assert.equal(result.sent, 148);
  assert.deepEqual(result.invalidTokens, ['ExponentPushToken[3]']);
});

Deno.test('never throws when Expo is down', async () => {
  const down = await sendPush(() => Promise.reject(new Error('boom')), [{ to: 'x', body: 'y' }]);
  assert.deepEqual(down, { sent: 0, invalidTokens: [] });
  const http500 = await sendPush(
    () => Promise.resolve(new Response('', { status: 500 })),
    [{ to: 'x', body: 'y' }],
  );
  assert.deepEqual(http500, { sent: 0, invalidTokens: [] });
});
