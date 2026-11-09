import assert from 'node:assert/strict';

import { type ApplyArgs, createHandler, pickUserId, planForProduct, statusFor } from './handler.ts';

const AUTH = 'Bearer whsec_test_value';
const USER = '11111111-1111-4111-8111-111111111111';
const MATE = '22222222-2222-4222-8222-222222222222';

function setup(authHeader: string | null = AUTH) {
  const applied: ApplyArgs[] = [];
  const handler = createHandler({
    authHeader,
    store: {
      apply: (a) => {
        applied.push(a);
        return Promise.resolve({ applied: a.plan });
      },
    },
  });
  return { handler, applied };
}

const post = (event: Record<string, unknown>, auth: string | null = AUTH) =>
  new Request('http://localhost/revenuecat-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify({ api_version: '1.0', event }),
  });

const purchase = (extra: Record<string, unknown> = {}) => ({
  id: 'evt-1',
  type: 'INITIAL_PURCHASE',
  app_user_id: USER,
  original_app_user_id: '$RCAnonymousID:abc',
  product_id: 'noskip.pro.annual',
  period_type: 'TRIAL',
  expiration_at_ms: Date.UTC(2027, 0, 1),
  event_timestamp_ms: Date.UTC(2026, 10, 9),
  ...extra,
});

Deno.test('refuses calls without the RevenueCat authorization header', async () => {
  const { handler, applied } = setup();
  assert.equal((await handler(post(purchase(), null))).status, 401);
  assert.equal((await handler(post(purchase(), 'Bearer wrong'))).status, 401);
  assert.equal((await setup(null).handler(post(purchase()))).status, 503);
  assert.equal(applied.length, 0);
});

Deno.test('stores a trial for the Supabase user', async () => {
  const { handler, applied } = setup();
  const res = await handler(post(purchase()));
  assert.equal(res.status, 200);
  assert.equal(applied[0].userId, USER);
  assert.equal(applied[0].plan, 'individual');
  assert.equal(applied[0].status, 'trialing');
  assert.equal(applied[0].expiresAt, '2027-01-01T00:00:00.000Z');
  assert.equal(applied[0].eventAt, '2026-11-09T00:00:00.000Z');
});

Deno.test('Duo and Team read the partner / team chosen in the app', async () => {
  const { handler, applied } = setup();
  await handler(
    post(
      purchase({
        id: 'evt-2',
        product_id: 'noskip.duo.annual',
        period_type: 'NORMAL',
        subscriber_attributes: { noskip_duo_partner: { value: MATE, updated_at_ms: 1 } },
      }),
    ),
  );
  await handler(
    post(
      purchase({
        id: 'evt-3',
        product_id: 'noskip.team.annual',
        subscriber_attributes: { noskip_team_id: { value: 'not-a-uuid' } },
      }),
    ),
  );
  assert.equal(applied[0].plan, 'duo');
  assert.equal(applied[0].partnerId, MATE);
  assert.equal(applied[0].status, 'active');
  assert.equal(applied[1].plan, 'team');
  assert.equal(applied[1].teamId, null);
});

Deno.test('skips events with nothing to store, and anonymous users', async () => {
  const { handler, applied } = setup();
  assert.deepEqual(await (await handler(post(purchase({ type: 'TEST' })))).json(), {
    skipped: 'TEST',
  });
  assert.deepEqual(
    await (await handler(post(purchase({ app_user_id: '$RCAnonymousID:x', aliases: [] })))).json(),
    { skipped: 'anonymous_user' },
  );
  assert.equal((await handler(post({ id: 'x' }))).status, 400);
  assert.equal(applied.length, 0);
});

Deno.test('product change uses the new product', async () => {
  const { handler, applied } = setup();
  await handler(post(purchase({ type: 'PRODUCT_CHANGE', new_product_id: 'noskip.team.annual' })));
  assert.equal(applied[0].plan, 'team');
});

Deno.test('mappings', () => {
  assert.equal(planForProduct('noskip.pro.weekly'), 'individual');
  assert.equal(planForProduct('NOSKIP_DUO_ANNUAL'), 'duo');
  assert.equal(statusFor('RENEWAL', 'NORMAL'), 'active');
  assert.equal(statusFor('CANCELLATION', 'NORMAL'), 'cancelled');
  assert.equal(statusFor('BILLING_ISSUE', null), 'billing_issue');
  assert.equal(statusFor('EXPIRATION', null), 'expired');
  assert.equal(statusFor('TRANSFER', null), null);
  assert.equal(pickUserId(['$RCAnonymousID:1', undefined, USER]), USER);
  assert.equal(pickUserId([]), null);
});
