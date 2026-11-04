import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { myTeamsKey, profileKey } from '@/features/profile/api';
import type { Tables } from '@/lib/database.types';
import { functionErrorCode } from '@/lib/errors';
import { db } from '@/lib/supabase';

export type MyTeam = {
  id: string;
  name: string;
  invite_code: string;
  role: Tables<'team_members'>['role'];
  accepted_rules_at: string | null;
  member_count: number;
};

export type TeamPreview = {
  team_id: string;
  name: string;
  member_count: number;
  capacity: number;
  member_pseudos: string[];
};

export type BoardRow = {
  user_id: string;
  pseudo: string | null;
  avatar_url: string | null;
  title: Tables<'profiles'>['title'];
  plate_color: string;
  role: Tables<'team_members'>['role'];
  goal: number;
  done: number;
  today_status: 'done' | 'at_gym' | 'not_yet';
  joker_this_week: boolean;
  is_me: boolean;
};

export const teamBoardKey = (teamId: string) => ['team-board', teamId] as const;

export function useMyTeams() {
  const uid = useUserId();
  return useQuery({
    queryKey: myTeamsKey(uid),
    queryFn: async (): Promise<MyTeam[]> => {
      const { data, error } = await db()
        .from('team_members')
        .select(
          'role, accepted_rules_at, joined_at, team:teams(id, name, invite_code, team_members(count))',
        )
        .eq('user_id', uid)
        .order('joined_at');
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const team = row.team as unknown as {
          id: string;
          name: string;
          invite_code: string;
          team_members: { count: number }[];
        } | null;
        if (!team) return [];
        return [
          {
            id: team.id,
            name: team.name,
            invite_code: team.invite_code,
            role: row.role,
            accepted_rules_at: row.accepted_rules_at,
            member_count: team.team_members[0]?.count ?? 1,
          },
        ];
      });
    },
  });
}

export function useTeamBoard(teamId: string | undefined) {
  return useQuery({
    queryKey: teamBoardKey(teamId ?? 'none'),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<BoardRow[]> => {
      const { data, error } = await db().rpc('team_board', { p_team: teamId! });
      if (error) throw error;
      return (data ?? []) as BoardRow[];
    },
  });
}

function useInvalidateTeams() {
  const uid = useUserId();
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: myTeamsKey(uid) }),
      queryClient.invalidateQueries({ queryKey: ['team-board'] }),
    ]);
}

export function useCreateTeam() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await db().rpc('create_team', { p_name: name.trim() });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

async function invokeJoinTeam<T>(body: { code: string; action: 'preview' | 'join' }): Promise<T> {
  const { data, error } = await db().functions.invoke<T>('join-team', { body });
  if (error) throw new Error((await functionErrorCode(error)) ?? 'join_failed');
  if (!data) throw new Error('join_failed');
  return data;
}

export function useTeamPreview(code: string | null) {
  return useQuery({
    queryKey: ['team-preview', code],
    enabled: Boolean(code),
    retry: false,
    queryFn: async () =>
      (await invokeJoinTeam<{ preview: TeamPreview }>({ code: code!, action: 'preview' })).preview,
  });
}

export function useJoinTeam() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async (code: string) =>
      (
        await invokeJoinTeam<{ team: { team_id: string; name: string; already_member: boolean } }>({
          code,
          action: 'join',
        })
      ).team,
    onSuccess: invalidate,
  });
}

export function useAcceptAllRules() {
  const uid = useUserId();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async () => {
      const { error } = await db().rpc('accept_all_team_rules');
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([invalidate(), queryClient.invalidateQueries({ queryKey: profileKey(uid) })]),
  });
}

export function useAcceptTeamRules() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await db().rpc('accept_team_rules', { p_team: teamId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useLeaveTeam() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await db().rpc('leave_team', { p_team: teamId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTeam() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await db().rpc('delete_team', { p_team: teamId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRenameTeam() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async ({ teamId, name }: { teamId: string; name: string }) => {
      const { error } = await db().rpc('rename_team', { p_team: teamId, p_name: name.trim() });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRegenerateInviteCode() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { data, error } = await db().rpc('regenerate_invite_code', { p_team: teamId });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useRemoveMember() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const { error } = await db().rpc('remove_member', { p_team: teamId, p_user: userId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useReportMember() {
  const uid = useUserId();
  return useMutation({
    mutationFn: async ({
      teamId,
      userId,
      reason,
    }: {
      teamId: string;
      userId: string;
      reason: string;
    }) => {
      const { error } = await db()
        .from('member_reports')
        .insert({ team_id: teamId, reporter_id: uid, reported_id: userId, reason: reason.trim() });
      if (error) throw error;
    },
  });
}
