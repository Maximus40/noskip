import { Redirect } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { nextOnboardingRoute } from '@/domain/onboarding';
import { useAuth } from '@/features/auth/AuthProvider';
import { signOut } from '@/features/auth/signIn';
import { useLocalOnboarding } from '@/features/onboarding/localStore';
import { useSignedInOnboardingState } from '@/features/onboarding/useOnboardingState';
import { useMergeOnboardingAnswers, useProfile } from '@/features/profile/api';
import { toUserMessage } from '@/lib/errors';
import { queryClient } from '@/lib/queryClient';
import { colors, spacing } from '@/theme/tokens';

/** Root gate: decides between onboarding steps, the paywall and the app. */
export default function Index() {
  const { configured, loading, session } = useAuth();
  const local = useLocalOnboarding();

  if (!configured) return <SetupRequired />;
  if (loading || !local.data) return <Loading />;
  if (!session) {
    // New phone, nothing answered yet: the welcome pages come first.
    const first = local.data.hook ? '/sign-in' : local.data.welcomeSeen ? '/hook' : '/welcome';
    return <Redirect href={first} />;
  }
  return <SignedInGate />;
}

function SignedInGate() {
  const { state, error } = useSignedInOnboardingState();
  useFlushHookAnswers();

  if (error) {
    return (
      <Screen>
        <Text variant="title">Connexion à la salle des machines…</Text>
        <ErrorNote message={toUserMessage(error)} />
        <Button label="Réessayer" onPress={() => queryClient.invalidateQueries()} />
        <Button
          label="Se déconnecter"
          variant="ghost"
          withArrow={false}
          onPress={() => signOut()}
        />
      </Screen>
    );
  }
  if (!state) return <Loading />;
  const next = nextOnboardingRoute(state);
  return <Redirect href={next ?? '/team'} />;
}

/** Hook answers given before sign-in are saved to the profile once, right after it. */
function useFlushHookAnswers() {
  const local = useLocalOnboarding();
  const profile = useProfile();
  const merge = useMergeOnboardingAnswers();
  const done = useRef(false);
  useEffect(() => {
    const hook = local.data?.hook;
    const answers = profile.data?.onboarding_answers as Record<string, unknown> | undefined;
    if (done.current || !hook || !answers || answers.planned_last_month !== undefined) return;
    done.current = true;
    merge.mutate({ planned_last_month: hook.planned, done_last_month: hook.done });
  }, [local.data, profile.data, merge]);
}

function Loading() {
  return (
    <View style={styles.loading} accessibilityLabel="Chargement">
      <Skeleton height={120} />
      <Skeleton height={64} />
      <Skeleton height={64} />
    </View>
  );
}

function SetupRequired() {
  return (
    <Screen>
      <Text variant="label" color={colors.accent}>
        Configuration
      </Text>
      <Text variant="title">Il manque la connexion au backend.</Text>
      <Text color={colors.muted}>
        Renseigne EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans le fichier .env
        (voir .env.example), puis relance le build.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    paddingTop: 120,
    gap: spacing.md,
  },
});
