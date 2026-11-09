import assert from 'node:assert/strict';

import { HttpError } from '../_shared/http.ts';
import { type AccountStore, createHandler } from './handler.ts';

function setup(opts: { solo?: string[]; failAvatars?: boolean } = {}) {
  const calls: string[] = [];
  const store: AccountStore = {
    handoverTeams: (id) => {
      calls.push(`handover:${id}`);
      return Promise.resolve(opts.solo ?? []);
    },
    deleteTeams: (ids) => {
      calls.push(`teams:${ids.join(',')}`);
      return Promise.resolve();
    },
    deleteAvatars: (id) => {
      calls.push(`avatars:${id}`);
      return opts.failAvatars ? Promise.reject(new Error('storage down')) : Promise.resolve();
    },
    deleteBillingLog: (id) => {
      calls.push(`billing:${id}`);
      return Promise.resolve();
    },
    deleteUser: (id) => {
      calls.push(`user:${id}`);
      return Promise.resolve();
    },
  };
  const handler = createHandler({
    authenticate: (req) =>
      req.headers.get('Authorization')
        ? Promise.resolve({ id: 'me' })
        : Promise.reject(new HttpError(401, 'not_authenticated')),
    store,
  });
  return { handler, calls };
}

const post = (body: unknown, auth = true) =>
  new Request('http://localhost/delete-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer x' } : {}) },
    body: JSON.stringify(body),
  });

Deno.test('requires a session and the typed confirmation', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(post({ confirm: 'SUPPRIMER' }, false))).status, 401);
  assert.equal((await handler(post({ confirm: 'supprimer' }))).status, 400);
  assert.equal((await handler(post({}))).status, 400);
  assert.equal((await handler(post({ confirm: 'SUPPRIMER', user_id: 'other' }))).status, 400);
  assert.equal(calls.length, 0);
});

Deno.test('deletes only the caller, teams handed over first, user last', async () => {
  const { handler, calls } = setup({ solo: ['t-solo'] });
  const res = await handler(post({ confirm: 'SUPPRIMER' }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { deleted: true });
  assert.deepEqual(calls, ['handover:me', 'teams:t-solo', 'avatars:me', 'billing:me', 'user:me']);
});

Deno.test('a failing step keeps the account (the player can retry)', async () => {
  const { handler, calls } = setup({ failAvatars: true });
  assert.equal((await handler(post({ confirm: 'SUPPRIMER' }))).status, 500);
  assert.ok(!calls.includes('user:me'));
});
