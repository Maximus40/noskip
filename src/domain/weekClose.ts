/**
 * Closing a game week — the reference model of `app_private.close_team_week` (SQL).
 * The server is the source of truth; this pure model documents the rules, is unit-tested,
 * and is the oracle `scripts/simulate-week.ts` checks the database against.
 */
import { KG_PER_SESSION } from './bar';

export type ClosingPlayer = {
  id: string;
  goal: number;
  done: number;
  joker: boolean;
  /** Calendar days of the week left when the player joined (7 if before Monday). */
  daysLeftAtJoin: number;
};

export type PlayerOutcome = {
  id: string;
  achieved: boolean;
  usedJoker: boolean;
  /** Joined too late to reach the goal: no SKIP card. */
  exempt: boolean;
  skip: boolean;
};

export type WeekOutcome = {
  totalKg: number;
  players: PlayerOutcome[];
  skippers: string[];
  /** Most sessions (ties: furthest above goal, then earliest in the list). */
  machine: string | null;
  /** Biggest deficit among SKIP cards (ties: fewest sessions, then earliest). */
  skipper: string | null;
  /** Every counted player (no joker, not exempt) reached the goal: the team lifts the bar. */
  teamPr: boolean;
  /** Team PR with more kg than any previous closed week. */
  isRecord: boolean;
};

/**
 * `players` must be in team order (join order): ties resolve to the earliest.
 * `previousBestKg`: best total of the team's previous closed weeks (null if none).
 */
export function closeWeek(players: ClosingPlayer[], previousBestKg: number | null): WeekOutcome {
  const outcomes: PlayerOutcome[] = players.map((p) => {
    const achieved = p.done >= p.goal;
    const exempt = !achieved && p.daysLeftAtJoin < p.goal;
    return {
      id: p.id,
      achieved,
      usedJoker: p.joker,
      exempt,
      skip: !achieved && !p.joker && !exempt,
    };
  });
  const totalKg = players.reduce((sum, p) => sum + p.done, 0) * KG_PER_SESSION;
  const counted = outcomes.filter((o) => !o.exempt && !o.usedJoker);
  const teamPr = counted.length > 0 && counted.every((o) => o.achieved);
  const isRecord = teamPr && totalKg > (previousBestKg ?? 0);

  const byIndex = players.map((p, index) => ({ p, index }));
  const machine =
    byIndex
      .filter(({ p }) => p.done > 0)
      .sort(
        (a, b) =>
          b.p.done - a.p.done || b.p.done - b.p.goal - (a.p.done - a.p.goal) || a.index - b.index,
      )[0]?.p.id ?? null;
  const skipSet = new Set(outcomes.filter((o) => o.skip).map((o) => o.id));
  const skipper =
    byIndex
      .filter(({ p }) => skipSet.has(p.id))
      .sort(
        (a, b) =>
          b.p.goal - b.p.done - (a.p.goal - a.p.done) || a.p.done - b.p.done || a.index - b.index,
      )[0]?.p.id ?? null;

  return {
    totalKg,
    players: outcomes,
    skippers: outcomes.filter((o) => o.skip).map((o) => o.id),
    machine,
    skipper,
    teamPr,
    isRecord,
  };
}

/** Calendar days of `weekStart`'s week left at `joinedAtDay` (ISO date, Paris). */
export function daysLeftAtJoin(joinedAtDay: string, weekStart: string): number {
  if (joinedAtDay < weekStart) return 7;
  const diff = Math.round(
    (Date.parse(`${joinedAtDay}T12:00:00Z`) - Date.parse(`${weekStart}T12:00:00Z`)) / 86_400_000,
  );
  return Math.max(0, 7 - diff);
}

export type StreakWeek = { weekStart: string; achieved: boolean; usedJoker: boolean };

/**
 * Consecutive weeks with the goal reached, most recent first in `weeks` or not (sorted here).
 * A joker week preserves the streak without extending it; a gap or a miss ends it.
 */
export function streakWeeks(weeks: StreakWeek[]): number {
  const sorted = [...weeks].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  let streak = 0;
  let expected: string | null = null;
  for (const w of sorted) {
    if (expected !== null && w.weekStart !== expected) break;
    if (w.achieved) streak += 1;
    else if (!w.usedJoker) break;
    expected = shiftWeek(w.weekStart, -7);
  }
  return streak;
}

/** Duo streak after a closed week (mirrors the SQL): both held → +1, joker → kept, miss → 0. */
export function nextDuoStreak(
  previous: { current: number; best: number; lastWeekStart: string | null } | null,
  weekStart: string,
  outcomes: PlayerOutcome[],
): { current: number; best: number } {
  const best = previous?.best ?? 0;
  if (outcomes.some((o) => !o.achieved && !o.usedJoker)) return { current: 0, best };
  const base =
    previous && previous.lastWeekStart === shiftWeek(weekStart, -7) ? previous.current : 0;
  const current = base + (outcomes.some((o) => o.usedJoker) ? 0 : 1);
  return { current, best: Math.max(best, current) };
}

export function shiftWeek(weekStart: string, days: number): string {
  const d = new Date(`${weekStart}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

function frenchDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]}`;
}

/** "Semaine du 26 oct. au 1er nov." */
export function weekRangeLabel(weekStart: string): string {
  return `Semaine du ${frenchDay(weekStart)} au ${frenchDay(shiftWeek(weekStart, 6))}`;
}

/** Compact range for tight spots (SKIP poster header): "26 oct. → 1er nov.". */
export function weekShortLabel(weekStart: string): string {
  return `${frenchDay(weekStart)} → ${frenchDay(shiftWeek(weekStart, 6))}`;
}

/** Team vs le Canap': kg for the team, one point per SKIP for the couch. */
export function scoreLine(kg: number, skips: number): { team: string; canap: string } {
  return { team: `${kg} kg`, canap: String(skips) };
}

/** One player's line in the Sunday recap. */
export function recapStatus(p: { achieved: boolean; usedJoker: boolean; exempt: boolean }): {
  label: string;
  tone: 'win' | 'skip' | 'neutral';
} {
  if (p.achieved) return { label: 'Objectif tenu', tone: 'win' };
  if (p.usedJoker) return { label: 'Joker blessure', tone: 'neutral' };
  if (p.exempt) return { label: 'A rejoint en cours de semaine', tone: 'neutral' };
  return { label: 'SKIP', tone: 'skip' };
}
