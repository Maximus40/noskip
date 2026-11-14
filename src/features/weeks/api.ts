import { useMutation, useQuery } from '@tanstack/react-query';

import { isPosterStyle } from '@/domain/shop';
import { db } from '@/lib/supabase';

export type RecapPlayer = {
  userId: string;
  pseudo: string;
  avatarUrl: string | null;
  plateColor: string;
  goal: number;
  done: number;
  achieved: boolean;
  usedJoker: boolean;
  exempt: boolean;
  cardId: string | null;
  lineId: string | null;
  isMe: boolean;
};

export type WeekRecap = {
  weekId: string;
  teamId: string;
  teamName: string;
  inviteCode: string;
  weekStart: string;
  totalKg: number;
  skipsCount: number;
  isTeamPr: boolean;
  isRecord: boolean;
  machineId: string | null;
  skipperId: string | null;
  players: RecapPlayer[];
};

export type HistoryWeek = {
  weekId: string;
  weekStart: string;
  totalKg: number;
  skipsCount: number;
  isTeamPr: boolean;
  isRecord: boolean;
  machinePseudo: string | null;
  skipperPseudo: string | null;
};

export const weekRecapKey = (weekId: string) => ['week-recap', weekId] as const;

async function fetchRecap(weekId: string): Promise<WeekRecap> {
  const { data, error } = await db().rpc('week_recap', { p_week_id: weekId });
  if (error) throw error;
  const rows = data ?? [];
  const first = rows[0];
  if (!first) throw new Error('not_found');
  return {
    weekId: first.week_id,
    teamId: first.team_id,
    teamName: first.team_name,
    inviteCode: first.invite_code,
    weekStart: first.week_start,
    totalKg: first.total_kg,
    skipsCount: first.skips_count,
    isTeamPr: first.is_team_pr,
    isRecord: first.is_record,
    machineId: first.machine_user_id,
    skipperId: first.skipper_user_id,
    players: rows.map((r) => ({
      userId: r.user_id,
      pseudo: r.pseudo ?? 'Un pote',
      avatarUrl: r.avatar_url,
      plateColor: r.plate_color,
      goal: r.goal,
      done: r.done,
      achieved: r.achieved,
      usedJoker: r.used_joker,
      exempt: r.exempt,
      cardId: r.card_id,
      lineId: r.line_id,
      isMe: r.is_me,
    })),
  };
}

export function useWeekRecap(weekId: string | undefined) {
  return useQuery({
    queryKey: weekRecapKey(weekId ?? 'none'),
    enabled: Boolean(weekId),
    staleTime: 5 * 60_000,
    queryFn: () => fetchRecap(weekId as string),
  });
}

/** A SKIP card (deep link from the push): its week recap + the card's player. */
export function useSkipCard(cardId: string | undefined) {
  return useQuery({
    queryKey: ['skip-card', cardId ?? 'none'],
    enabled: Boolean(cardId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: weekId, error } = await db().rpc('skip_card_week', {
        p_card: cardId as string,
      });
      if (error) throw error;
      const [recap, card] = await Promise.all([
        fetchRecap(weekId),
        db()
          .from('skip_cards')
          .select('poster_style')
          .eq('id', cardId as string)
          .maybeSingle(),
      ]);
      if (card.error) throw card.error;
      const player = recap.players.find((p) => p.cardId === cardId);
      if (!player) throw new Error('not_found');
      const style = card.data?.poster_style;
      return { recap, player, style: isPosterStyle(style) ? style : ('classic' as const) };
    },
  });
}

export function useTeamHistory(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team-history', teamId ?? 'none'],
    enabled: Boolean(teamId),
    queryFn: async (): Promise<HistoryWeek[]> => {
      const { data, error } = await db().rpc('team_history', { p_team: teamId as string });
      if (error) throw error;
      return (data ?? []).map((w) => ({
        weekId: w.week_id,
        weekStart: w.week_start,
        totalKg: w.total_kg,
        skipsCount: w.skips_count,
        isTeamPr: w.is_team_pr,
        isRecord: w.is_record,
        machinePseudo: w.machine_pseudo,
        skipperPseudo: w.skipper_pseudo,
      }));
    },
  });
}

/** Latest closed week of a team, to surface the Sunday recap on "Ma team". */
export function useLatestClosedWeek(teamId: string | undefined) {
  return useQuery({
    queryKey: ['latest-closed-week', teamId ?? 'none'],
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data, error } = await db().rpc('latest_closed_week', { p_team: teamId as string });
      if (error) throw error;
      const row = data?.[0];
      return row
        ? { weekId: row.week_id, weekStart: row.week_start, closedAt: row.closed_at }
        : null;
    },
  });
}

export function useCountSkipShare() {
  return useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await db().rpc('increment_skip_share', { p_card: cardId });
      if (error) throw error;
    },
  });
}
