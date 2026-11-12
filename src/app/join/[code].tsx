import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { normalizeInviteCode, pseudoList, teamFill } from '@/domain/teams';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUpdateLocalOnboarding } from '@/features/onboarding/localStore';
import { useAcceptTeamRules, useJoinTeam, useTeamPreview } from '@/features/teams/api';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing } from '@/theme/tokens';

/** Deep link dipsorchips://join/<code> (and https://<host>/join/<code>). */
export default function JoinScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeInviteCode(params.code ?? '');
  const { session, loading } = useAuth();

  if (!code) {
    return (
      <Screen>
        <Text variant="title">Lien d&apos;invitation cassé.</Text>
        <Text color={colors.muted}>
          Demande à ton pote de te renvoyer le lien, ou tape le code à la main.
        </Text>
        <Button label="Retour" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  if (loading)
    return (
      <Screen>
        <Skeleton height={160} />
      </Screen>
    );
  if (!session) return <RememberAndOnboard code={code} />;
  return <JoinAsMember code={code} />;
}

/** Not signed in yet: keep the code, run onboarding; the team step joins automatically. */
function RememberAndOnboard({ code }: { code: string }) {
  const update = useUpdateLocalOnboarding();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    update.mutate({ pendingInviteCode: code }, { onSuccess: () => setSaved(true) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
  return saved ? (
    <Redirect href="/" />
  ) : (
    <Screen>
      <Skeleton height={160} />
    </Screen>
  );
}

function JoinAsMember({ code }: { code: string }) {
  const preview = useTeamPreview(code);
  const join = useJoinTeam();
  const acceptRules = useAcceptTeamRules();
  const [accepted, setAccepted] = useState(false);
  const fill = preview.data ? teamFill(preview.data.member_count, preview.data.capacity) : null;
  const error = preview.error ?? join.error ?? acceptRules.error;

  async function onJoin() {
    try {
      const team = await join.mutateAsync(code);
      await acceptRules.mutateAsync(team.team_id);
      router.replace('/');
    } catch {
      // Shown through ErrorNote.
    }
  }

  return (
    <Screen
      footer={
        preview.data ? (
          <>
            <Button
              label={`Rejoindre « ${preview.data.name} »`}
              disabled={!accepted || fill?.full || join.isPending || acceptRules.isPending}
              onPress={onJoin}
            />
            <Button
              label="Pas maintenant"
              variant="ghost"
              withArrow={false}
              onPress={() => router.replace('/')}
            />
          </>
        ) : null
      }
    >
      <Text variant="label" color={colors.accent}>
        Invitation
      </Text>
      {preview.isLoading ? (
        <Skeleton height={160} />
      ) : preview.data ? (
        <>
          <Text variant="display" accessibilityRole="header">
            {preview.data.name}
          </Text>
          <View style={styles.card}>
            <Text variant="headline">{pseudoList(preview.data.member_pseudos)}</Text>
            <Text variant="caption" color={colors.muted}>
              {fill?.full ? 'Team complète.' : `${fill?.label} · une place t'attend sur la barre.`}
            </Text>
          </View>
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            label="J'accepte d'être chambré par le Canap' si je skip."
          />
        </>
      ) : null}
      <ErrorNote message={error ? toUserMessage(error) : null} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.xl,
    gap: spacing.xs,
  },
});
