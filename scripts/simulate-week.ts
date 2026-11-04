/**
 * Simulates a full game week end to end, without a phone:
 *   1. creates a test team (4 players) and a duo in the database,
 *   2. injects validated sessions, an injury joker and fake push tokens for last week,
 *   3. runs the real `close-week` handler (close at 20:00, then recap at 20:05) against the
 *      database, with push sending mocked,
 *   4. checks the SKIP cards, PR, duo streak and notifications against the domain model
 *      (src/domain/weekClose.ts), replays everything to prove idempotence, then cleans up.
 *
 * Run: `npm run simulate:week` (local throwaway PostgreSQL, like `npm run test:db`), or
 * `SIM_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run simulate:week`
 * against `supabase start`. Never point it at production.
 */
import { SKIP_LINES } from '../content/skip-lines.ts';
import {
  createHandler,
  type WeekStore,
  type WeekSummary,
} from '../supabase/functions/close-week/handler.ts';
import { cronAuthorizer } from '../supabase/functions/_shared/cron.ts';
import type { PushMessage } from '../supabase/functions/_shared/push.ts';
import { closeWeek, type ClosingPlayer } from '../src/domain/weekClose.ts';

const DB_URL = Deno.env.get('SIM_DB_URL') ?? 'postgresql://postgres@localhost:54329/noskip_test';
const SECRET = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');

// ---------------------------------------------------------------------------
// Tiny psql bridge (no driver needed). Every call is its own transaction, like PostgREST.
// ---------------------------------------------------------------------------
async function sql(query: string, role: 'postgres' | 'service_role' = 'postgres'): Promise<string> {
  const prefix = role === 'service_role' ? 'set role service_role;\n' : '';
  const cmd = new Deno.Command('psql', {
    args: ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', DB_URL, '-c', prefix + query],
    stdout: 'piped',
    stderr: 'piped',
  });
  const out = await cmd.output();
  if (!out.success) throw new Error(new TextDecoder().decode(out.stderr).trim());
  return new TextDecoder().decode(out.stdout).trim();
}

const lit = (v: unknown) => `'${String(v).replaceAll("'", "''")}'`;

async function rows<T>(fn: string, args: string): Promise<T[]> {
  // Sub-select: with a single-column function, `from f() t` would alias the column, not the row.
  const out = await sql(
    `select coalesce(json_agg(t), '[]') from (select * from public.${fn}(${args})) t;`,
    'service_role',
  );
  return JSON.parse(out) as T[];
}

async function scalar<T>(fn: string, args: string): Promise<T> {
  const out = await sql(`select to_json(public.${fn}(${args}));`, 'service_role');
  return JSON.parse(out) as T;
}

const store: WeekStore = {
  dueWeek: () => scalar<string>('svc_due_week', ''),
  teamsToClose: async (week) =>
    (await rows<{ team_id: string }>('svc_teams_to_close', lit(week))).map((r) => r.team_id),
  recentLines: async (team, limit) =>
    (await rows<{ line_id: string }>('svc_recent_skip_lines', `${lit(team)}, ${limit}`)).map(
      (r) => r.line_id,
    ),
  memberIds: async (team) =>
    (await rows<{ user_id: string }>('svc_team_member_ids', lit(team))).map((r) => r.user_id),
  closeTeamWeek: (team, week, lines) =>
    scalar(
      'svc_close_team_week',
      `${lit(team)}, ${lit(week)}, ${lit(JSON.stringify(lines))}::jsonb`,
    ),
  pending: async (step) =>
    (await rows<{ week_id: string }>('svc_weeks_pending_notification', lit(step))).map(
      (r) => r.week_id,
    ),
  claim: (weekId, step) =>
    scalar<boolean>('svc_claim_week_notification', `${lit(weekId)}, ${lit(step)}`),
  summary: (weekId) => scalar<WeekSummary | null>('svc_week_summary', lit(weekId)),
  teamTargets: async (team, pref) =>
    (await rows<{ token: string }>('svc_team_push_targets', `${lit(team)}, ${lit(pref)}`)).map(
      (r) => r.token,
    ),
  deleteTokens: async (tokens) => {
    await sql(
      `select public.svc_delete_push_tokens(array[${tokens.map(lit).join(',')}]::text[]);`,
      'service_role',
    );
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
type Player = {
  key: string;
  pseudo: string;
  goal: number;
  days: number[];
  joker?: boolean;
  joinDay?: number;
};

const MAIN: Player[] = [
  { key: 'karim', pseudo: 'Karim', goal: 3, days: [0, 2, 4] },
  { key: 'maxime', pseudo: 'Maxime', goal: 3, days: [1] },
  { key: 'sofiane', pseudo: 'Sofiane', goal: 2, days: [], joker: true },
  { key: 'lina', pseudo: 'Lina', goal: 3, days: [], joinDay: 5 },
];
const DUO: Player[] = [
  { key: 'ines', pseudo: 'Ines', goal: 2, days: [0, 3] },
  { key: 'tom', pseudo: 'Tom', goal: 2, days: [1, 5] },
];

const ids = new Map<string, string>();
const teamIds: Record<string, string> = {};
const tokenOwner = new Map<string, string>();
let failures = 0;

function check(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.error(`  ✗ ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

async function seed(week: string) {
  const gym = await sql(
    `insert into public.gyms (osm_id, name, lat, lng) values ('node/9${Math.floor(Math.random() * 1e9)}', 'Salle de simulation', 48.85, 2.35) returning id;`,
  );
  const createdAt = `(${lit(week)}::date - 30)::timestamptz`;
  for (const [teamKey, name, players] of [
    ['main', 'Les Déchaînés (simulation)', MAIN],
    ['duo', 'Binôme (simulation)', DUO],
  ] as const) {
    const ownerId = crypto.randomUUID();
    for (const [i, p] of players.entries()) {
      const id = i === 0 ? ownerId : crypto.randomUUID();
      ids.set(p.key, id);
      await sql(
        `insert into auth.users (id, email) values (${lit(id)}, ${lit(`${p.key}.${id.slice(0, 8)}@simulation.local`)});`,
      );
      await sql(
        `update public.profiles set pseudo = ${lit(p.pseudo)}, weekly_goal = ${p.goal} where id = ${lit(id)};`,
      );
    }
    const team = await sql(
      `insert into public.teams (name, created_by, invite_code, created_at)
       values (${lit(name)}, ${lit(ownerId)}, app_private.new_invite_code(), ${createdAt}) returning id;`,
    );
    teamIds[teamKey] = team;
    for (const [i, p] of players.entries()) {
      const joined =
        p.joinDay === undefined
          ? createdAt
          : `((${lit(week)}::date + ${p.joinDay})::timestamp + interval '10 hours') at time zone 'Europe/Paris'`;
      await sql(
        `insert into public.team_members (team_id, user_id, role, joined_at, accepted_rules_at, plate_color)
         values (${lit(team)}, ${lit(ids.get(p.key))}, '${i === 0 ? 'owner' : 'member'}', ${joined}, now(), app_private.next_plate_color(${lit(team)}));`,
      );
      const token = `ExponentPushToken[sim-${p.key}-${crypto.randomUUID().slice(0, 6)}]`;
      tokenOwner.set(token, p.pseudo);
      await sql(
        `insert into public.push_tokens (user_id, token, platform) values (${lit(ids.get(p.key))}, ${lit(token)}, 'ios');`,
      );
      for (const d of p.days) {
        const at = (h: number) =>
          `((${lit(week)}::date + ${d})::timestamp + interval '${h} hours') at time zone 'Europe/Paris'`;
        await sql(
          `insert into public.sessions (user_id, gym_id, source, started_at, ended_at, duration_min, validated_at, local_date)
           values (${lit(ids.get(p.key))}, ${lit(gym)}, 'geofence', ${at(18)}, ${at(19)}, 60, ${at(19)}, ${lit(week)}::date + ${d});`,
        );
      }
      if (p.joker) {
        await sql(
          `insert into public.jokers (user_id, month, week_start) values (${lit(ids.get(p.key))}, date_trunc('month', ${lit(week)}::date)::date, ${lit(week)});`,
        );
      }
    }
  }
  return gym;
}

async function cleanup(gym: string | null) {
  const users = [...ids.values()].map(lit).join(',');
  if (users) {
    await sql(
      `delete from public.teams where id in (${Object.values(teamIds).map(lit).join(',') || 'null'});`,
    );
    await sql(`delete from auth.users where id in (${users});`);
  }
  if (gym) await sql(`delete from public.gyms where id = ${lit(gym)};`);
  await sql(`delete from app_private.cron_config where secret = ${lit(SECRET)};`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
function modelFor(players: Player[]): ClosingPlayer[] {
  return players.map((p) => ({
    id: ids.get(p.key)!,
    goal: p.goal,
    done: p.days.length,
    joker: p.joker ?? false,
    daysLeftAtJoin: p.joinDay === undefined ? 7 : 7 - p.joinDay,
  }));
}

async function main() {
  let gym: string | null = null;
  const pushed: PushMessage[] = [];
  try {
    const hadConfig = (await sql(`select count(*) from app_private.cron_config;`)) !== '0';
    if (hadConfig)
      throw new Error('app_private.cron_config existe déjà : base de prod ? Simulation annulée.');
    await sql(
      `insert into app_private.cron_config (functions_url, secret) values ('https://simulation.local/functions/v1', ${lit(SECRET)});`,
    );

    const week = await store.dueWeek();
    console.log(`Semaine simulée : ${week}`);
    gym = await seed(week);

    let seedValue = 42;
    const handler = createHandler({
      authorize: cronAuthorizer((s) => scalar<boolean>('svc_cron_secret_ok', lit(s))),
      store,
      push: (messages) => {
        pushed.push(...messages);
        return Promise.resolve({ sent: messages.length, invalidTokens: [] });
      },
      random: () => {
        seedValue = (seedValue * 9301 + 49297) % 233280;
        return seedValue / 233280;
      },
    });
    const call = async (body: unknown, secret = SECRET) => {
      const res = await handler(
        new Request('http://localhost/close-week', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
          body: JSON.stringify(body),
        }),
      );
      return { status: res.status, body: await res.json() };
    };

    console.log('\nSécurité');
    check((await call({ step: 'close' }, 'x'.repeat(40))).status === 401, 'mauvais secret refusé');

    console.log('\nDimanche 20:00 — clôture');
    const close = await call({ step: 'close', week_start: week });
    check(close.status === 200, 'close-week répond 200', close.body);

    for (const [teamKey, players] of [
      ['main', MAIN],
      ['duo', DUO],
    ] as const) {
      const model = closeWeek(modelFor(players), null);
      const team = teamIds[teamKey];
      const w = JSON.parse(
        await sql(
          `select row_to_json(w) from public.weeks w where team_id = ${lit(team)} and week_start = ${lit(week)};`,
        ),
      );
      const cards = JSON.parse(
        await sql(
          `select coalesce(json_agg(c order by c.user_id), '[]') from public.skip_cards c where team_id = ${lit(team)};`,
        ),
      ) as { user_id: string; line_id: string }[];
      console.log(`  — ${teamKey === 'main' ? 'team de 4' : 'duo'}`);
      check(w.closed_at !== null, 'semaine close');
      check(w.total_kg === model.totalKg, `kilos = ${model.totalKg}`, w.total_kg);
      check(
        JSON.stringify(cards.map((c) => c.user_id).sort()) ===
          JSON.stringify([...model.skippers].sort()),
        `cartes SKIP = ${model.skippers.length}`,
        cards,
      );
      check(
        cards.every((c) => SKIP_LINES.some((l) => l.id === c.line_id)),
        'vannes tirées dans la banque',
      );
      check(new Set(cards.map((c) => c.line_id)).size === cards.length, 'vannes distinctes');
      check(w.machine_user_id === model.machine, 'Machine de la semaine');
      check(w.skipper_user_id === model.skipper, 'Skippeur de la semaine');
      check(w.is_team_pr === model.teamPr, `PR de la team : ${model.teamPr ? 'oui' : 'non'}`);
      check(w.is_record === model.isRecord, `record : ${model.isRecord ? 'oui' : 'non'}`);
    }
    const duo = JSON.parse(
      await sql(
        `select row_to_json(d) from public.duo_streaks d where team_id = ${lit(teamIds.duo)};`,
      ),
    );
    check(duo?.current_weeks === 1, 'série du binôme : 1 semaine', duo);

    const skipPushes = pushed.filter((m) => m.data?.type === 'skip');
    const prPushes = pushed.filter((m) => m.data?.type === 'team_pr');
    check(skipPushes.length === MAIN.length, 'push SKIP à toute la team (4)', skipPushes.length);
    check(
      skipPushes.every((m) => m.body === "SKIP. Maxime a choisi le canap'."),
      "« SKIP. Maxime a choisi le canap'. »",
    );
    check(prPushes.length === DUO.length, 'push PR au duo (2)', prPushes.length);
    check(
      prPushes[0]?.body === 'PR DE LA TEAM ! 80 kg soulevés cette semaine 🏆',
      '« PR DE LA TEAM ! 80 kg… »',
      prPushes[0]?.body,
    );

    console.log('\nRejeu (cron qui tourne deux fois)');
    const before = pushed.length;
    const replay = await call({ step: 'close', week_start: week });
    check(replay.body.closed === 0, 'aucune semaine reclôturée', replay.body);
    check(pushed.length === before, 'aucun push en double');
    const cardCount = await sql(
      `select count(*) from public.skip_cards where team_id in (${Object.values(teamIds).map(lit).join(',')});`,
    );
    check(cardCount === '1', 'toujours 1 seule carte SKIP', cardCount);

    console.log('\nDimanche 20:05 — bilan');
    pushed.length = 0;
    const recap = await call({ step: 'recap' });
    check(recap.status === 200, 'bilan envoyé', recap.body);
    const recapMain = pushed.filter((m) => m.data?.team_id === teamIds.main);
    check(recapMain.length === MAIN.length, 'bilan à toute la team');
    check(
      recapMain[0]?.body === 'Bilan : la team a soulevé 80 kg. Machine de la semaine : Karim.',
      '« Bilan : la team a soulevé 80 kg. Machine de la semaine : Karim. »',
      recapMain[0]?.body,
    );
    pushed.length = 0;
    await call({ step: 'recap' });
    check(pushed.length === 0, 'bilan jamais envoyé deux fois');

    console.log('\nNotifications produites (mockées) :');
    const seen = new Set<string>();
    for (const m of [...skipPushes, ...prPushes]) {
      const key = `${m.body}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  • ${m.title} — ${m.body}`);
    }
  } finally {
    await cleanup(gym);
  }
  if (failures > 0) {
    console.error(`\n${failures} vérification(s) en échec.`);
    Deno.exit(1);
  }
  console.log('\nSimulation OK.');
}

await main();
