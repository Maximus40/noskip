import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';

import { useUserId } from '@/features/auth/AuthProvider';
import type { Json, Tables, TablesUpdate } from '@/lib/database.types';
import { db } from '@/lib/supabase';
import { type FoundGym, resolveGym } from '@/features/gyms/api';

export type Profile = Tables<'profiles'>;
export type LifterTitle = Profile['title'];

export const LIFTER_TITLES: { value: LifterTitle; label: string }[] = [
  { value: 'machine', label: 'Machine' },
  { value: 'bro_du_lundi', label: 'Bro du lundi' },
  { value: 'toujours_au_shaker', label: 'Toujours au shaker' },
  { value: 'skippeur_de_jambes', label: 'Skippeur de jambes' },
];

export const profileKey = (uid: string) => ['profile', uid] as const;
export const myGymsKey = (uid: string) => ['my-gyms', uid] as const;
export const myTeamsKey = (uid: string) => ['my-teams', uid] as const;

export function useProfile() {
  const uid = useUserId();
  return useQuery({
    queryKey: profileKey(uid),
    queryFn: async () => {
      const { data, error } = await db().from('profiles').select('*').eq('id', uid).single();
      if (error) throw error;
      return data;
    },
  });
}

type EditableProfile = Pick<
  TablesUpdate<'profiles'>,
  | 'pseudo'
  | 'avatar_url'
  | 'title'
  | 'onboarding_answers'
  | 'onboarded_at'
  | 'sound_enabled'
  | 'haptics_enabled'
  | 'notification_prefs'
>;

export function useUpdateProfile() {
  const uid = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: EditableProfile) => {
      const { data, error } = await db()
        .from('profiles')
        .update(patch)
        .eq('id', uid)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => queryClient.setQueryData(profileKey(uid), data),
  });
}

/** Merges keys into profiles.onboarding_answers (hook answers, goal confirmation). */
export function useMergeOnboardingAnswers() {
  const update = useUpdateProfile();
  const profile = useProfile();
  return useMutation({
    mutationFn: async (patch: Record<string, Json>) => {
      const current = (profile.data?.onboarding_answers ?? {}) as Record<string, Json>;
      return update.mutateAsync({ onboarding_answers: { ...current, ...patch } });
    },
  });
}

export function useSetWeeklyGoal() {
  const uid = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goal: number) => {
      const { data, error } = await db().rpc('set_weekly_goal', { p_goal: goal });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => queryClient.setQueryData(profileKey(uid), data),
  });
}

export function useMyGyms() {
  const uid = useUserId();
  return useQuery({
    queryKey: myGymsKey(uid),
    queryFn: async () => {
      const { data, error } = await db()
        .from('user_gyms')
        .select('is_primary, chosen_at, gym:gyms(id, name, address, lat, lng)')
        .eq('user_id', uid)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useChooseGym() {
  const uid = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gymId,
      gym,
      primary = true,
    }: {
      gymId?: string;
      /** A search hit: verified and stored by the server first if it has no id yet. */
      gym?: FoundGym;
      primary?: boolean;
    }) => {
      const id = gymId ?? (gym ? await resolveGym(gym) : null);
      if (!id) throw new Error('gym_not_found');
      const { data, error } = await db().rpc('choose_gym', {
        p_gym_id: id,
        p_make_primary: primary,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myGymsKey(uid) }),
  });
}

export function useRemoveGym() {
  const uid = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gymId: string) => {
      const { error } = await db().rpc('remove_gym', { p_gym_id: gymId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myGymsKey(uid) }),
  });
}

export function useMyTeamCount() {
  const uid = useUserId();
  return useQuery({
    queryKey: [...myTeamsKey(uid), 'count'],
    queryFn: async () => {
      const { count, error } = await db()
        .from('team_members')
        .select('team_id', { count: 'exact', head: true })
        .eq('user_id', uid);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Pro access lives with the subscriptions feature; re-exported for the onboarding gate. */
export { useHasPro } from '@/features/subscriptions/api';

/** Uploads a square avatar to Storage (avatars/<uid>/...) and stores its public URL. */
export function useUploadAvatar() {
  const uid = useUserId();
  const update = useUpdateProfile();
  return useMutation({
    mutationFn: async ({ uri, mimeType }: { uri: string; mimeType: string }) => {
      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const bytes = await new File(uri).arrayBuffer();
      const storage = db().storage.from('avatars');
      const { error } = await storage.upload(path, bytes, { contentType: mimeType, upsert: true });
      if (error) throw error;
      const { data } = storage.getPublicUrl(path);
      return update.mutateAsync({ avatar_url: data.publicUrl });
    },
  });
}
