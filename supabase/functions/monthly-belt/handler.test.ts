import assert from 'node:assert/strict';

import { cronAuthorizer } from '../_shared/cron.ts';
import type { PushMessage } from '../_shared/push.ts';
import { beltMessage, type BeltStore, type BeltType, createHandler } from './handler.ts';

const SECRET = 'b'.repeat(40);

function setup(opts: { due?: string | null; failTeam?: string } = {}) {
  const belts = new Map<string, { team: string; month: string; type: BeltType; user: string }>();
  const claims = new Set<string>();
  const pushed: PushMessage[][] = [];
  const store: BeltStore = {
    dueMonth: () => Promise.resolve(opts.due === undefined ? '2026-10-01' : opts.due),
    teamsForMonth: () => Promise.resolve(['t1', 't2']),
    award: (team, month) => {
      if (team === opts.failTeam) return Promise.reject(new Error('boom'));
      const out: { type: BeltType; user_id: string }[] = [];
      for (const [type, user] of [
        ['belt', `${team}-karim`],
        ['big_canap', `${team}-maxime`],
      ] as const) {
        const key = `${team}:${month}:${type}`;
        if (!belts.has(key)) {
          belts.set(key, { team, month, type, user });
          out.push({ type, user_id: user });
        }
      }
      return Promise.resolve(out);
    },
    pending: () =>
      Promise.resolve(
        [...belts.entries()]
          .filter(([key]) => !claims.has(key))
          .map(([, b]) => ({
            team_id: b.team,
            team_name: `Team ${b.team}`,
            month: b.month,
            type: b.type,
            user_id: b.user,
            pseudo: b.type === 'belt' ? 'Karim' : 'Maxime',
          })),
      ),
    claim: (team, month, type) => {
      const key = `${team}:${month}:${type}`;
      if (claims.has(key)) return Promise.resolve(false);
      claims.add(key);
      return Promise.resolve(true);
    },
    teamTargets: (team) => Promise.resolve([`tok-${team}`]),
    deleteTokens: () => Promise.resolve(),
  };
  const handler = createHandler({
    authorize: cronAuthorizer((s) => Promise.resolve(s === SECRET)),
    store,
    push: (m) => {
      pushed.push(m);
      return Promise.resolve({ sent: m.length, invalidTokens: [] });
    },
  });
  return { handler, pushed, belts };
}

const post = (body: unknown, secret: string | null = SECRET) =>
  new Request('http://localhost/monthly-belt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-cron-secret': secret } : {}) },
    body: JSON.stringify(body),
  });

Deno.test('only pg_cron can run it, with a strict body', async () => {
  const { handler, belts } = setup();
  assert.equal((await handler(post({}, null))).status, 401);
  assert.equal((await handler(post({ month: '2026-10-02' }))).status, 400);
  assert.equal((await handler(post({ extra: true }))).status, 400);
  assert.equal(belts.size, 0);
});

Deno.test('waits for the 1st at 10:00 Paris', async () => {
  const { handler, belts } = setup({ due: null });
  assert.deepEqual(await (await handler(post({}))).json(), { skipped: 'too_early' });
  assert.equal(belts.size, 0);
});

Deno.test('awards every team, tells each team once, replays do nothing', async () => {
  const { handler, pushed } = setup();
  const body = await (await handler(post({}))).json();
  assert.deepEqual(body, { month: '2026-10-01', awarded: 4, failed: 0, pushed: 4 });
  const texts = pushed.flat().map((m) => m.body);
  assert.ok(
    texts.includes("🥇 Karim décroche la Ceinture d'octobre. Le plus régulier de la team."),
  );
  assert.ok(texts.includes("Trophée Gros Canap' d'octobre : Maxime. Le Canap' est fier de toi."));
  pushed.length = 0;
  const again = await (await handler(post({}))).json();
  assert.equal(again.awarded, 0);
  assert.equal(pushed.length, 0);
});

Deno.test('one failing team does not block the others', async () => {
  const { handler } = setup({ failTeam: 't1' });
  const body = await (await handler(post({ month: '2026-09-01' }))).json();
  assert.equal(body.failed, 1);
  assert.equal(body.awarded, 2);
});

Deno.test('French copy', () => {
  assert.equal(
    beltMessage('belt', null, '2026-12-01'),
    '🥇 Un pote décroche la Ceinture de décembre. Le plus régulier de la team.',
  );
});
