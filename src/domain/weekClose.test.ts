import { SKIP_LINES, skipLineText } from '../../content/skip-lines';
import { pickSkipLines, RECENT_LINES_AVOIDED } from './skipDraw';
import {
  closeWeek,
  type ClosingPlayer,
  daysLeftAtJoin,
  nextDuoStreak,
  recapStatus,
  scoreLine,
  shiftWeek,
  streakWeeks,
  weekRangeLabel,
  weekShortLabel,
} from './weekClose';

const player = (id: string, goal: number, done: number, extra: Partial<ClosingPlayer> = {}) => ({
  id,
  goal,
  done,
  joker: false,
  daysLeftAtJoin: 7,
  ...extra,
});

describe('closeWeek', () => {
  it('mirrors the SQL scenario: one SKIP, a joker, a late joiner', () => {
    const out = closeWeek(
      [
        player('karim', 3, 3),
        player('maxime', 3, 1),
        player('sofiane', 2, 0, { joker: true }),
        player('lina', 3, 0, { daysLeftAtJoin: 2 }),
      ],
      null,
    );
    expect(out.totalKg).toBe(80);
    expect(out.skippers).toEqual(['maxime']);
    expect(out.machine).toBe('karim');
    expect(out.skipper).toBe('maxime');
    expect(out.teamPr).toBe(false);
    expect(out.isRecord).toBe(false);
    expect(out.players.find((p) => p.id === 'lina')).toMatchObject({ exempt: true, skip: false });
    expect(out.players.find((p) => p.id === 'sofiane')).toMatchObject({
      usedJoker: true,
      skip: false,
    });
  });

  it('a late joiner who still reached the goal is not exempt', () => {
    const out = closeWeek([player('a', 2, 2, { daysLeftAtJoin: 2 })], null);
    expect(out.players[0]).toMatchObject({ achieved: true, exempt: false });
    expect(out.teamPr).toBe(true);
  });

  it('team PR when everyone counted achieved; record only above the previous best', () => {
    const players = [player('a', 2, 3), player('b', 2, 2), player('c', 3, 0, { joker: true })];
    expect(closeWeek(players, null)).toMatchObject({ teamPr: true, isRecord: true, totalKg: 100 });
    expect(closeWeek(players, 100)).toMatchObject({ teamPr: true, isRecord: false });
    expect(closeWeek(players, 80).isRecord).toBe(true);
  });

  it('no PR when nobody counts (all on joker) or the team is empty', () => {
    expect(closeWeek([player('a', 2, 0, { joker: true })], null).teamPr).toBe(false);
    expect(closeWeek([], null)).toMatchObject({ teamPr: false, machine: null, skipper: null });
  });

  it('machine and skipper tie-breaks', () => {
    const out = closeWeek(
      [player('a', 4, 3), player('b', 2, 3), player('c', 3, 1), player('d', 4, 2)],
      null,
    );
    // a and b both did 3: b is further above goal.
    expect(out.machine).toBe('b');
    // c and d both miss 2: c did fewer sessions.
    expect(out.skipper).toBe('c');
    const tie = closeWeek([player('x', 3, 0), player('y', 3, 0)], null);
    expect(tie.machine).toBeNull();
    expect(tie.skipper).toBe('x');
  });
});

describe('streaks', () => {
  it('counts consecutive achieved weeks; a joker preserves without extending', () => {
    expect(
      streakWeeks([
        { weekStart: '2026-10-26', achieved: true, usedJoker: false },
        { weekStart: '2026-10-19', achieved: false, usedJoker: true },
        { weekStart: '2026-10-12', achieved: true, usedJoker: false },
        { weekStart: '2026-10-05', achieved: false, usedJoker: false },
        { weekStart: '2026-09-28', achieved: true, usedJoker: false },
      ]),
    ).toBe(2);
  });

  it('a gap ends the streak', () => {
    expect(
      streakWeeks([
        { weekStart: '2026-10-26', achieved: true, usedJoker: false },
        { weekStart: '2026-10-12', achieved: true, usedJoker: false },
      ]),
    ).toBe(1);
    expect(streakWeeks([])).toBe(0);
  });

  it('duo streak follows the SQL rules', () => {
    const held = [
      { id: 'a', achieved: true, usedJoker: false, exempt: false, skip: false },
      { id: 'b', achieved: true, usedJoker: false, exempt: false, skip: false },
    ];
    const joker = [
      held[0],
      { id: 'b', achieved: false, usedJoker: true, exempt: false, skip: false },
    ];
    const miss = [
      held[0],
      { id: 'b', achieved: false, usedJoker: false, exempt: false, skip: true },
    ];
    expect(nextDuoStreak(null, '2026-10-26', held)).toEqual({ current: 1, best: 1 });
    const prev = { current: 3, best: 4, lastWeekStart: '2026-10-19' };
    expect(nextDuoStreak(prev, '2026-10-26', held)).toEqual({ current: 4, best: 4 });
    expect(nextDuoStreak(prev, '2026-10-26', joker)).toEqual({ current: 3, best: 4 });
    expect(nextDuoStreak(prev, '2026-10-26', miss)).toEqual({ current: 0, best: 4 });
    expect(nextDuoStreak(prev, '2026-11-09', held)).toEqual({ current: 1, best: 4 });
  });
});

describe('dates and labels', () => {
  it('days left when joining', () => {
    expect(daysLeftAtJoin('2026-10-20', '2026-10-26')).toBe(7);
    expect(daysLeftAtJoin('2026-10-26', '2026-10-26')).toBe(7);
    expect(daysLeftAtJoin('2026-10-31', '2026-10-26')).toBe(2);
    expect(daysLeftAtJoin('2026-11-01', '2026-10-26')).toBe(1);
  });

  it('week range in French', () => {
    expect(weekRangeLabel('2026-10-26')).toBe('Semaine du 26 oct. au 1er nov.');
    expect(weekShortLabel('2026-10-26')).toBe('26 oct. → 1er nov.');
    expect(weekRangeLabel('2026-12-28')).toBe('Semaine du 28 déc. au 3 janv.');
    expect(shiftWeek('2026-03-23', 7)).toBe('2026-03-30');
  });

  it('recap status', () => {
    const base = { achieved: false, usedJoker: false, exempt: false };
    expect(recapStatus({ ...base, achieved: true })).toEqual({
      label: 'Objectif tenu',
      tone: 'win',
    });
    expect(recapStatus({ ...base, usedJoker: true }).label).toBe('Joker blessure');
    expect(recapStatus({ ...base, exempt: true }).label).toBe('A rejoint en cours de semaine');
    expect(recapStatus(base)).toEqual({ label: 'SKIP', tone: 'skip' });
  });

  it('score line', () => {
    expect(scoreLine(200, 1)).toEqual({ team: '200 kg', canap: '1' });
  });
});

describe('SKIP lines', () => {
  const ids = SKIP_LINES.map((l) => l.id);

  it('has at least 40 unique lines, all short enough for the poster', () => {
    expect(SKIP_LINES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ids).size).toBe(ids.length);
    for (const line of SKIP_LINES) {
      expect(line.id).toMatch(/^[a-z0-9-]+$/);
      expect(line.text.replace('{pseudo}', 'Maximilien').length).toBeLessThanOrEqual(90);
    }
  });

  it('never targets the body or the weight', () => {
    const banned =
      /\b(gros|grosse|gras|poids|ventre|bide|kilos? en trop|moche|nul|nulle|bouboule)\b/i;
    for (const line of SKIP_LINES) expect(line.text).not.toMatch(banned);
  });

  it('renders the pseudo and falls back on unknown ids', () => {
    expect(skipLineText('leg-day', 'Maxime')).toBe(
      "Maxime a skip la salle. Même le leg day n'y croyait plus.",
    );
    expect(skipLineText('removed-id', 'Maxime')).toBe(SKIP_LINES[0].text);
  });

  it('draws distinct lines and avoids the recent ones', () => {
    const recent = ids.slice(0, RECENT_LINES_AVOIDED);
    for (let seed = 0; seed < 50; seed += 1) {
      let s = seed;
      const random = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
      const picked = pickSkipLines(ids, recent, 4, random);
      expect(picked).toHaveLength(4);
      expect(new Set(picked).size).toBe(4);
      for (const id of picked) expect(recent).not.toContain(id);
    }
  });

  it('reuses the oldest recent lines once fresh ones run out, then cycles', () => {
    expect(pickSkipLines(['a', 'b', 'c'], ['a', 'b'], 1, () => 0)).toEqual(['c']);
    expect(pickSkipLines(['a', 'b', 'c'], ['a', 'b'], 2, () => 0)).toEqual(['c', 'b']);
    expect(pickSkipLines(['a', 'b'], ['a', 'b'], 3, () => 0.99)).toEqual(['b', 'a', 'a']);
    expect(pickSkipLines([], [], 2, Math.random)).toEqual([]);
    expect(pickSkipLines(['a'], [], 0, Math.random)).toEqual([]);
  });
});
