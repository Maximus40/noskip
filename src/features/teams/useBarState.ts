import { useMemo } from 'react';

import { allAchieved, type BarPlayer, platesFor, teamKg } from '@/domain/bar';
import { weekRisk, type WeekRisk } from '@/domain/week';
import { colors } from '@/theme/tokens';

import type { BoardRow } from './api';

export type BarState = {
  players: (BarPlayer & { risk: WeekRisk })[];
  plates: ReturnType<typeof platesFor>;
  kg: number;
  shaky: boolean;
  pr: boolean;
};

/** Turns the server board into what the bar and the player list draw. */
export function barState(rows: BoardRow[], now: number): BarState {
  const players = rows.map((r) => {
    const base: BarPlayer = {
      id: r.user_id,
      pseudo: r.pseudo ?? 'Un pote',
      color: r.plate_color,
      isMe: r.is_me,
      goal: r.goal,
      done: r.done,
      status: r.today_status,
      joker: r.joker_this_week,
    };
    const risk = weekRisk(
      { goal: base.goal, done: base.done, doneToday: base.status === 'done', joker: base.joker },
      now,
    );
    return { ...base, risk };
  });
  return {
    players,
    plates: platesFor(players, colors.accent),
    kg: teamKg(players),
    shaky: players.some((p) => p.risk === 'shaky'),
    pr: allAchieved(players),
  };
}

export function useBarState(rows: BoardRow[] | undefined, now: number): BarState | null {
  return useMemo(() => (rows ? barState(rows, now) : null), [rows, now]);
}
