import { useAuth } from '@/features/auth/AuthProvider';
import { useHasPro, useMyGyms, useMyTeamCount, useProfile } from '@/features/profile/api';
import type { OnboardingState } from '@/domain/onboarding';

import { useLocalOnboarding } from './localStore';

type Answers = { planned_last_month?: unknown; goal_confirmed_at?: unknown };

/** Signed-in onboarding facts, combining server data and device-local flags. */
export function useSignedInOnboardingState(): { state: OnboardingState | null; error: unknown } {
  const local = useLocalOnboarding();
  const profile = useProfile();
  const gyms = useMyGyms();
  const teams = useMyTeamCount();
  const pro = useHasPro();
  const queries = [local, profile, gyms, teams, pro];
  const error = queries.find((q) => q.error)?.error ?? null;
  if (
    !local.data ||
    !profile.data ||
    !gyms.data ||
    teams.data === undefined ||
    pro.data === undefined
  ) {
    return { state: null, error };
  }
  const answers = (profile.data.onboarding_answers ?? {}) as Answers;
  return {
    error,
    state: {
      hookAnswered: answers.planned_last_month !== undefined || local.data.hook !== null,
      signedIn: true,
      hasPrimaryGym: gyms.data.some((g) => g.is_primary),
      goalConfirmed: typeof answers.goal_confirmed_at === 'string',
      hasPseudo: Boolean(profile.data.pseudo),
      teamCount: teams.data,
      locationAsked: local.data.locationAsked,
      rulesAccepted: profile.data.rules_accepted_at !== null,
      notificationsAsked: local.data.notificationsAsked,
      hasPro: pro.data,
    },
  };
}

export function useIsSignedIn(): boolean {
  return useAuth().session !== null;
}
