/**
 * Personal progression: personal bar levels, streaks, seasons (calendar months) and the
 * monthly Ceinture. Pure. The belt ranking mirrors app_private.award_team_belts (SQL).
 */
import { personalBarKg } from './bar';
import { streakWeeks, type StreakWeek } from './weekClose';

export type Level = { name: string; minKg: number };

/** Barre à vide (20 kg) → Gym bro (60) → Machine (100) → Monstre (160) → Légende (250). */
export const LEVELS: readonly Level[] = [
  { name: 'Barre à vide', minKg: 20 },
  { name: 'Gym bro', minKg: 60 },
  { name: 'Machine', minKg: 100 },
  { name: 'Monstre', minKg: 160 },
  { name: 'Légende', minKg: 250 },
];

export type LevelState = {
  kg: number;
  level: Level;
  index: number;
  next: Level | null;
  /** 0 → 1 towards the next level (1 at Légende). */
  progress: number;
  /** Sessions still needed for the next level (0 at Légende). */
  sessionsToNext: number;
};

export function levelFor(lifetimeSessions: number): LevelState {
  const kg = personalBarKg(Math.max(0, lifetimeSessions));
  let index = 0;
  LEVELS.forEach((l, i) => {
    if (kg >= l.minKg) index = i;
  });
  const level = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  if (!next) return { kg, level, index, next, progress: 1, sessionsToNext: 0 };
  const progress = (kg - level.minKg) / (next.minKg - level.minKg);
  return {
    kg,
    level,
    index,
    next,
    progress,
    sessionsToNext: Math.ceil((next.minKg - kg) / 2.5),
  };
}

export type HistoryWeek = {
  weekStart: string;
  achieved: boolean;
  usedJoker: boolean;
  exempt: boolean;
};

/** Joker and late-join weeks keep the streak alive without extending it. */
function toStreak(weeks: HistoryWeek[]): StreakWeek[] {
  return weeks.map((w) => ({
    weekStart: w.weekStart,
    achieved: w.achieved,
    usedJoker: w.usedJoker || (w.exempt && !w.achieved),
  }));
}

/** Current streak: consecutive weeks with the goal reached, up to the last closed week. */
export function currentStreak(weeks: HistoryWeek[]): number {
  return streakWeeks(toStreak(weeks));
}

/** Longest streak ever. */
export function bestStreak(weeks: HistoryWeek[]): number {
  const sorted = toStreak(weeks).sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const w of sorted) {
    const consecutive = previous !== null && daysBetween(previous, w.weekStart) === 7;
    if (!consecutive) run = 0;
    if (w.achieved) run += 1;
    else if (!w.usedJoker) run = 0;
    best = Math.max(best, run);
    previous = w.weekStart;
  }
  return best;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** "septembre 2026" from "2026-09-01". */
export function monthLabel(isoMonth: string): string {
  const [y, m] = isoMonth.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Ceinture de septembre" / "Gros Canap' d'octobre" (elision before a vowel). */
export function trophyLabel(type: 'belt' | 'big_canap', isoMonth: string): string {
  const name = MONTHS[Number(isoMonth.split('-')[1]) - 1];
  const of = /^[aeiouyéè]/.test(name) ? `d'${name}` : `de ${name}`;
  return type === 'belt' ? `Ceinture ${of}` : `Gros Canap' ${of}`;
}

export type MonthStats = {
  id: string;
  /** Weeks that count (no joker, not exempt). */
  counted: number;
  achieved: number;
  sessions: number;
  skips: number;
};

/**
 * `players` in join order (ties resolve to the earliest).
 * Ceinture: best goal-reached rate (at least one goal reached), then most sessions.
 * Gros Canap': most SKIP cards (at least one), then fewest sessions.
 */
export function awardBelts(players: MonthStats[]): {
  belt: string | null;
  bigCanap: string | null;
} {
  const indexed = players.map((p, index) => ({ p, index }));
  const belt =
    indexed
      .filter(({ p }) => p.counted > 0 && p.achieved > 0)
      .sort(
        (a, b) =>
          b.p.achieved / b.p.counted - a.p.achieved / a.p.counted ||
          b.p.sessions - a.p.sessions ||
          a.index - b.index,
      )[0]?.p.id ?? null;
  const bigCanap =
    indexed
      .filter(({ p }) => p.skips > 0)
      .sort((a, b) => b.p.skips - a.p.skips || a.p.sessions - b.p.sessions || a.index - b.index)[0]
      ?.p.id ?? null;
  return { belt, bigCanap };
}

/** What the joker button says. */
export function jokerState(card: {
  jokerThisWeek: boolean;
  jokerMonthUsed: boolean;
}): 'active' | 'used' | 'available' {
  if (card.jokerThisWeek) return 'active';
  if (card.jokerMonthUsed) return 'used';
  return 'available';
}
