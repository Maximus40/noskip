import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { HistoryWeek } from '@/domain/progression';
import type { Tables } from '@/lib/database.types';
import { db } from '@/lib/supabase';

export type Trophy = { type: 'belt' | 'big_canap'; month: string; teamName: string };

export type LifterCardData = {
  userId: string;
  pseudo: string;
  avatarUrl: string | null;
  title: Tables<'profiles'>['title'];
  plateColor: string;
  lifetimeSessions: number;
  skipsTotal: number;
  trophies: Trophy[];
  history: HistoryWeek[];
  jokerThisWeek: boolean;
  jokerMonthUsed: boolean;
  isMe: boolean;
};

export const lifterCardKey = (userId: string | null) => ['lifter-card', userId ?? 'me'] as const;

/** My card (no id) or a teammate's. */
export function useLifterCard(userId?: string) {
  return useQuery({
    queryKey: lifterCardKey(userId ?? null),
    queryFn: async (): Promise<LifterCardData> => {
      const { data, error } = await db().rpc('lifter_card', userId ? { p_user: userId } : {});
      if (error) throw error;
      const row = data?.[0];
      if (!row) throw new Error('not_found');
      const trophies = (
        row.belts as { type: Trophy['type']; month: string; team_name: string }[]
      ).map((b) => ({ type: b.type, month: b.month, teamName: b.team_name }));
      const history = (
        row.history as {
          week_start: string;
          achieved: boolean;
          used_joker: boolean;
          exempt: boolean;
        }[]
      ).map((h) => ({
        weekStart: h.week_start,
        achieved: h.achieved,
        usedJoker: h.used_joker,
        exempt: h.exempt,
      }));
      return {
        userId: row.user_id,
        pseudo: row.pseudo ?? 'Un pote',
        avatarUrl: row.avatar_url,
        title: row.title,
        plateColor: row.plate_color,
        lifetimeSessions: row.lifetime_sessions,
        skipsTotal: row.skips_total,
        trophies,
        history,
        jokerThisWeek: row.joker_this_week,
        jokerMonthUsed: row.joker_month_used,
        isMe: row.is_me,
      };
    },
  });
}

/** Joker blessure for the current week (server checks: 1 per month, goal not reached yet). */
/** Feeling better: withdraws this week's joker (the month's joker is given back). */
export function useCancelJoker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await db().rpc('cancel_joker');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: lifterCardKey(null) });
      qc.invalidateQueries({ queryKey: ['team-board'] });
    },
  });
}

export function useDeclareJoker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await db().rpc('declare_joker');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: lifterCardKey(null) });
      qc.invalidateQueries({ queryKey: ['team-board'] });
    },
  });
}
