import assert from 'node:assert/strict';

import { HttpError } from '../_shared/http.ts';
import { createHandler, type JoinResult, mapDbError, type TeamGateway } from './handler.ts';

const preview = {
  team_id: 't1',
  name: 'Les Déchaînés',
  member_count: 2,
  capacity: 4,
  member_pseudos: ['Sofiane', 'Karim'],
};

function setup(joinImpl?: (user: string, code: string) => Promise<JoinResult>) {
  const calls: { user: string; code: string }[] = [];
  const teams: TeamGateway = {
    preview: (code) => Promise.resolve(code === 'ABCD2345' ? preview : null),
    join: (user, code) => {
      calls.push({ user, code });
      return joinImpl
        ? joinImpl(user, code)
        : Promise.resolve({ team_id: 't1', name: 'Les Déchaînés', already_member: false });
    },
  };
  const handler = createHandler({
    authenticate: (req) =>
      req.headers.get('Authorization')
        ? Promise.resolve({ id: 'user-42' })
        : Promise.reject(new HttpError(401, 'not_authenticated')),
    teams,
  });
  return { handler, calls };
}

function post(body: unknown, auth = true) {
  return new Request('http://localhost/join-team', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer jwt' } : {}),
    },
    body: JSON.stringify(body),
  });
}

Deno.test('requires a signed-in user', async () => {
  const { handler } = setup();
  const res = await handler(post({ code: 'ABCD2345' }, false));
  assert.equal(res.status, 401);
});

Deno.test('normalises and validates the invite code', async () => {
  const { handler, calls } = setup();
  const ok = await handler(post({ code: 'abcd-2345' }));
  assert.equal(ok.status, 200);
  assert.deepEqual(calls, [{ user: 'user-42', code: 'ABCD2345' }]);
  for (const bad of ['ABC', 'ABCD234O', 12345678, null]) {
    const res = await handler(post({ code: bad }));
    assert.equal(res.status, 400, String(bad));
    assert.deepEqual(await res.json(), { error: 'invalid_invite_code' });
  }
});

Deno.test('preview returns team facts without joining', async () => {
  const { handler, calls } = setup();
  const res = await handler(post({ code: 'ABCD2345', action: 'preview' }));
  assert.deepEqual(await res.json(), { preview });
  assert.equal(calls.length, 0);
  const missing = await handler(post({ code: 'ZZZZ2345', action: 'preview' }));
  assert.equal(missing.status, 404);
});

Deno.test('join uses the caller id from the JWT, never from the body', async () => {
  const { handler, calls } = setup();
  await handler(post({ code: 'ABCD2345', user_id: 'someone-else' }));
  assert.equal(calls[0].user, 'user-42');
});

Deno.test('database limits map to stable error codes', async () => {
  for (const [message, status] of [
    ['team_full', 409],
    ['max_teams_reached', 409],
    ['invalid_invite_code', 404],
  ] as const) {
    const { handler } = setup(() => Promise.reject(new Error(message)));
    const res = await handler(post({ code: 'ABCD2345' }));
    assert.equal(res.status, status);
    assert.deepEqual(await res.json(), { error: message });
  }
  const { handler } = setup(() => Promise.reject(new Error('connection reset')));
  const res = await handler(post({ code: 'ABCD2345' }));
  assert.equal(res.status, 500);
  assert.equal(mapDbError('something else'), null);
});
