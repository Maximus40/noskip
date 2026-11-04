/**
 * Game-week arithmetic in Europe/Paris, matching the SQL helpers:
 * a week runs Monday 00:00 → Sunday 20:00 (Paris). Pure; `now` is an epoch ms.
 */

const PARIS = 'Europe/Paris';

type ParisParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function parisParts(now: number): ParisParts {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(now)).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday as string],
  };
}

/** ISO date (YYYY-MM-DD) of the Paris calendar day. */
export function parisDate(now: number): string {
  const p = parisParts(now);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True once Sunday 20:00 Paris is reached: the week is closed. */
export function isAfterDeadline(now: number): boolean {
  const p = parisParts(now);
  return p.weekday === 7 && p.hour >= 20;
}

/** Monday (YYYY-MM-DD) of the game week containing `now`. */
export function gameWeekStart(now: number): string {
  const p = parisParts(now);
  const monday = addDays(parisDate(now), -(p.weekday - 1));
  return isAfterDeadline(now) ? addDays(monday, 7) : monday;
}

/**
 * Calendar days on which a session can still count this week, today included.
 * Sunday after 20:00 belongs to the next week, so it counts as a full new week (7).
 */
export function sessionDaysLeft(now: number): number {
  if (isAfterDeadline(now)) return 7;
  return 8 - parisParts(now).weekday;
}

export type PlayerWeek = { goal: number; done: number; doneToday: boolean; joker?: boolean };

export type WeekRisk = 'achieved' | 'safe' | 'shaky' | 'lost';

/**
 * - achieved: goal reached;
 * - shaky: the goal is still possible only by going every remaining day ("la barre tremble");
 * - lost: no longer reachable (one session per calendar day max);
 * - safe: otherwise. A player with a joker is never at risk.
 */
export function weekRisk(player: PlayerWeek, now: number): WeekRisk {
  if (player.done >= player.goal) return 'achieved';
  if (player.joker) return 'safe';
  const remaining = player.goal - player.done;
  const days = sessionDaysLeft(now) - (player.doneToday ? 1 : 0);
  if (remaining > days) return 'lost';
  if (remaining === days) return 'shaky';
  return 'safe';
}
