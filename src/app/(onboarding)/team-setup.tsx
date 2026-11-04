import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InviteCard } from '@/components/InviteCard';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { OptionCard } from '@/components/ui/OptionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { onboardingStepNumber } from '@/domain/onboarding';
import { extractInviteCode, pseudoList, validateTeamName } from '@/domain/teams';
import { useLocalOnboarding, useUpdateLocalOnboarding } from '@/features/onboarding/localStore';
import { useCreateTeam, useJoinTeam, useMyTeams, useTeamPreview } from '@/features/teams/api';
import { toUserMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/tokens';

type Mode = 'create' | 'join';

export default function TeamSetupStep() {
  const local = useLocalOnboarding();
  const updateLocal = useUpdateLocalOnboarding();
  const teams = useMyTeams();
  const pending = local.data?.pendingInviteCode ?? null;

  const [mode, setMode] = useState<Mode | null>(null);
  const [name, setName] = useState('');
  const [rawCode, setRawCode] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const create = useCreateTeam();
  const join = useJoinTeam();

  const effectiveMode: Mode = mode ?? (pending ? 'join' : 'create');
  const code = extractInviteCode(rawCode) ?? (mode === null ? pending : null);
  const preview = useTeamPreview(effectiveMode === 'join' ? code : null);
  const nameError = validateTeamName(name);
  const created = create.data ?? null;

  // A player who arrived through an invite link joins as soon as the preview is known.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (autoJoined.current || !pending || mode !== null || !preview.data || join.isPending) return;
    autoJoined.current = true;
    join.mutate(pending, {
      onSuccess: () => {
        updateLocal.mutate({ pendingInviteCode: null });
        router.replace('/');
      },
    });
  }, [pending, mode, preview.data, join, updateLocal]);

  const error = create.error ?? join.error ?? (preview.error && code ? preview.error : null);

  // After creating: share the invite right away (it is part of onboarding), then continue.
  if (created) {
    return (
      <OnboardingScreen
        step={onboardingStepNumber('/team-setup')}
        title={`« ${created.name} » est créée.`}
        subtitle="Une barre, ça se charge à plusieurs. Envoie le lien à ton binôme maintenant, il le recevra là où vous parlez déjà."
        footer={
          <Button
            label="Continuer"
            variant="secondary"
            onPress={() => router.replace('/')}
            accessibilityHint="Tu pourras inviter plus tard depuis l'onglet Teams"
          />
        }
      >
        <InviteCard teamName={created.name} code={created.invite_code} memberCount={1} />
      </OnboardingScreen>
    );
  }

  if (teams.isLoading || local.isLoading) {
    return (
      <OnboardingScreen step={onboardingStepNumber('/team-setup')} title="Ta team.">
        <Skeleton height={72} />
        <Skeleton height={72} />
      </OnboardingScreen>
    );
  }

  return (
    <OnboardingScreen
      step={onboardingStepNumber('/team-setup')}
      title="Avec qui tu soulèves ?"
      subtitle="Crée ta team ou rejoins celle de tes potes. À 2 ou 3, c'est là que ça marche le mieux."
      footer={
        effectiveMode === 'create' ? (
          <Button
            label="Créer la team"
            disabled={Boolean(nameError) || create.isPending}
            onPress={() => create.mutate(name)}
          />
        ) : (
          <Button
            label={preview.data ? `Rejoindre « ${preview.data.name} »` : 'Rejoindre'}
            disabled={!code || !preview.data || join.isPending}
            onPress={() =>
              code &&
              join.mutate(code, {
                onSuccess: () => {
                  updateLocal.mutate({ pendingInviteCode: null });
                  router.replace('/');
                },
              })
            }
          />
        )
      }
    >
      <View style={styles.choice} accessibilityRole="radiogroup">
        <OptionCard
          selected={effectiveMode === 'create'}
          onPress={() => setMode('create')}
          title="Créer une team"
          subtitle="Tu choisis le nom, tu invites tes potes."
        />
        <OptionCard
          selected={effectiveMode === 'join'}
          onPress={() => setMode('join')}
          title="Rejoindre une team"
          subtitle="Avec le code ou le lien reçu."
        />
      </View>

      {effectiveMode === 'create' ? (
        <TextField
          label="Nom de la team"
          value={name}
          onChangeText={setName}
          onBlur={() => setNameTouched(true)}
          error={nameTouched ? nameError : null}
          maxLength={32}
          placeholder="Les Déchaînés"
          autoCapitalize="words"
          returnKeyType="done"
        />
      ) : (
        <>
          <TextField
            label="Code ou lien d'invitation"
            value={rawCode || (mode === null && pending ? pending : '')}
            onChangeText={setRawCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="ABCD-2345"
          />
          {preview.isFetching ? <Skeleton height={72} /> : null}
          {preview.data ? (
            <View style={styles.preview}>
              <Text variant="headline">{preview.data.name}</Text>
              <Text variant="caption" color={colors.muted}>
                {`${pseudoList(preview.data.member_pseudos)} · ${preview.data.member_count} / ${preview.data.capacity} joueurs`}
              </Text>
            </View>
          ) : null}
        </>
      )}
      <ErrorNote message={error ? toUserMessage(error) : null} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  choice: { gap: spacing.sm },
  preview: { gap: spacing.xs, paddingVertical: spacing.sm },
});
