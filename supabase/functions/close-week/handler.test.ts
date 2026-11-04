import assert from 'node:assert/strict';

import { cronAuthorizer, formatKg } from '../_shared/cron.ts';
import { SKIP_LINE_IDS } from '../_shared/generated/skipLineIds.ts';
import type { PushMessage } from '../_shared/push.ts';
import {
  createHandler,
  prMessage,
  recapMessage,
  skipMessage,
  type WeekStore,
  type WeekSummary,
} from './handler.ts';

const SECRET = 's'.repeat(40);

/** In-memory store with the same semantics as the SQL (idempotent close, one-shot claims). */
function fakeStore(opts: { failTeam?: string } = {}) {
  const state = {
    closed: new Map<string, Record<string, string>>(),
    claims: new Set<string>(),
    deleted: [] as string[][],
    closeCalls: 0,
  };
  const summaries: Record<string, WeekSummary> = {
    'week-t1': {
      week_id: 'week-t1',
      team_id: 't1',
      team_name: 'Les Déchaînés',
      week_start: '2026-10-26',
      total_kg: 1240,
      skips_count: 1,
      is_team_pr: false,
      is_record: false,
      machine_pseudo: 'Karim',
      skip_cards: [{ card_id: 'c1', user_id: 'maxime', pseudo: 'Maxime' }],
    },
    'week-t2': {
      week_id: 'week-t2',
      team_id: 't2',
      team_name: 'Binôme',
      week_start: '2026-10-26',
      total_kg: 100,
      skips_count: 0,
      is_team_pr: true,
      is_record: true,
      machine_pseudo: 'Inès',
      skip_cards: [],
    },
  };
  const store: WeekStore = {
    dueWeek: () => Promise.resolve('2026-10-26'),
    teamsToClose: () => Promise.resolve(['t1', 't2', 't3'].filter((t) => !state.closed.has(t))),
    recentLines: (team) => Promise.resolve(team === 't1' ? SKIP_LINE_IDS.slice(0, 20) : []),
    memberIds: (team) =>
      Promise.resolve(team === 't1' ? ['karim', 'maxime', 'sofiane'] : ['ines', 'tom']),
    closeTeamWeek: (team, _week, lines) => {
      state.closeCalls += 1;
      if (team === opts.failTeam) return Promise.reject(new Error('boom'));
      const newly = !state.closed.has(team);
      if (newly) state.closed.set(team, lines);
      return Promise.resolve({ week_id: `week-${team}`, newly_closed: newly });
    },
    pending: (step) =>
      Promise.resolve(
        [...state.closed.keys()]
          .map((t) => `week-${t}`)
          .filter((w) => summaries[w] && !state.claims.has(`${w}:${step}`)),
      ),
    claim: (weekId, step) => {
      const key = `${weekId}:${step}`;
      if (state.claims.has(key)) return Promise.resolve(false);
      state.claims.add(key);
      return Promise.resolve(true);
    },
    summary: (weekId) => Promise.resolve(summaries[weekId] ?? null),
    teamTargets: (team, pref) =>
      Promise.resolve(pref === 'recap' && team === 't2' ? [] : [`tok-${team}-a`, `tok-${team}-b`]),
    deleteTokens: (tokens) => {
      state.deleted.push(tokens);
      return Promise.resolve();
    },
  };
  return { store, state };
}

function setup(opts: { failTeam?: string } = {}) {
  const { store, state } = fakeStore(opts);
  const pushed: PushMessage[][] = [];
  const handler = createHandler({
    authorize: cronAuthorizer((s) => Promise.resolve(s === SECRET)),
    store,
    push: (m) => {
      pushed.push(m);
      return Promise.resolve({ sent: m.length, invalidTokens: ['tok-t1-b'] });
    },
    random: () => 0.5,
  });
  return { handler, state, pushed };
}

const post = (body: unknown, secret: string | null = SECRET) =>
  new Request('http://localhost/close-week', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-cron-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  });

Deno.test('only pg_cron (the shared secret) can run it', async () => {
  const { handler, state } = setup();
  assert.equal((await handler(post({ step: 'close' }, null))).status, 401);
  assert.equal((await handler(post({ step: 'close' }, 't'.repeat(40)))).status, 401);
  assert.equal((await handler(post({ step: 'close' }, 'short'))).status, 401);
  assert.equal(state.closeCalls, 0);
});

Deno.test('validates the body', async () => {
  const { handler } = setup();
  assert.equal((await handler(post({ step: 'nope' }))).status, 400);
  assert.equal((await handler(post({ step: 'close', extra: 1 }))).status, 400);
  assert.equal((await handler(post({ step: 'close', week_start: '2026-10-27' }))).status, 400);
  const get = new Request('http://localhost/close-week', { method: 'GET' });
  assert.equal((await handler(get)).status, 405);
});

Deno.test('closes every team with fresh, distinct lines, then pushes SKIP and PR', async () => {
  const { handler, state, pushed } = setup();
  const res = await handler(post({ step: 'close' }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.week_start, '2026-10-26');
  assert.equal(body.closed, 3);

  const t1Lines = Object.values(state.closed.get('t1')!);
  assert.equal(new Set(t1Lines).size, 3);
  for (const line of t1Lines) assert.ok(!SKIP_LINE_IDS.slice(0, 20).includes(line));
  assert.deepEqual(Object.keys(state.closed.get('t1')!), ['karim', 'maxime', 'sofiane']);

  const bodies = pushed.flat().map((m) => m.body);
  assert.ok(bodies.includes("SKIP. Maxime a choisi le canap'."));
  assert.ok(bodies.includes('PR DE LA TEAM ! 100 kg soulevés cette semaine 🏆'));
  const skip = pushed.flat().find((m) => m.data?.type === 'skip')!;
  assert.deepEqual(skip.data, { type: 'skip', card_id: 'c1', week_id: 'week-t1', team_id: 't1' });
  assert.equal(skip.title, 'Les Déchaînés');
  assert.ok(state.deleted.length > 0, 'dead tokens are deleted');
});

Deno.test('replaying close-week sends nothing twice', async () => {
  const { handler, pushed } = setup();
  await handler(post({ step: 'close' }));
  const before = pushed.flat().length;
  const res = await handler(post({ step: 'close' }));
  assert.equal((await res.json()).closed, 0);
  assert.equal(pushed.flat().length, before);
});

Deno.test('one failing team does not block the others', async () => {
  const { handler, state } = setup({ failTeam: 't2' });
  const body = await (await handler(post({ step: 'close' }))).json();
  assert.equal(body.failed, 1);
  assert.equal(body.closed, 2);
  assert.ok(state.closed.has('t1'));
});

Deno.test('recap at 20:05, once', async () => {
  const { handler, pushed } = setup();
  await handler(post({ step: 'close' }));
  pushed.length = 0;
  const body = await (await handler(post({ step: 'recap' }))).json();
  assert.equal(body.weeks, 2);
  const recap = pushed.flat();
  assert.equal(recap.length, 2);
  assert.equal(recap[0].body, 'Bilan : la team a soulevé 1 240 kg. Machine de la semaine : Karim.');
  assert.equal(recap[0].data?.type, 'recap');
  pushed.length = 0;
  await handler(post({ step: 'recap' }));
  assert.equal(pushed.flat().length, 0);
});

Deno.test('French copy', () => {
  assert.equal(skipMessage(null), "SKIP. Un pote a choisi le canap'.");
  assert.equal(prMessage(12000), 'PR DE LA TEAM ! 12 000 kg soulevés cette semaine 🏆');
  assert.equal(
    recapMessage(0, null),
    "Bilan : la team a soulevé 0 kg. Le Canap' remporte la semaine.",
  );
  assert.equal(formatKg(980), '980');
});
