import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { OptionCard } from '@/components/ui/OptionCard';
import { Text } from '@/components/ui/Text';
import { onboardingStepNumber } from '@/domain/onboarding';
import { useMergeOnboardingAnswers, useProfile, useSetWeeklyGoal } from '@/features/profile/api';
import { toUserMessage } from '@/lib/errors';
import { colors } from '@/theme/tokens';
import { useGoNext } from '@/features/onboarding/useGoNext';

const GOALS = [
  { value: 2, title: '2 séances', subtitle: 'Tranquille, mais toutes les semaines.' },
  { value: 3, title: '3 séances', subtitle: 'Le bon rythme. Le Canap’ déteste.' },
  { value: 4, title: '4 séances', subtitle: 'Sérieux. Ta team va devoir suivre.' },
  { value: 5, title: '5 séances', subtitle: 'Mode machine. Pas de jour off pour le shaker.' },
] as const;

export default function GoalStep() {
  const goNext = useGoNext();
  const editing = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const profile = useProfile();
  const [goal, setGoal] = useState<number | null>(null);
  const selected = goal ?? profile.data?.weekly_goal ?? 3;
  const setWeeklyGoal = useSetWeeklyGoal();
  const merge = useMergeOnboardingAnswers();
  const busy = setWeeklyGoal.isPending || merge.isPending;
  const error = setWeeklyGoal.error ?? merge.error;

  return (
    <OnboardingScreen
      step={onboardingStepNumber('/goal')}
      why={
        editing
          ? undefined
          : 'Chaque séance validée charge un disque. Objectif tenu dimanche 20 h : la team valide. Raté : carte SKIP envoyée à toute la team.'
      }
      editLabel={editing ? 'Réglages' : undefined}
      title="Combien de séances par semaine ?"
      subtitle="Un objectif que tu tiens vaut mieux qu'un objectif qui fait joli. Tu pourras le changer, effet la semaine suivante."
      footer={
        <Button
          label={editing ? `Passer à ${selected} séances` : `Je m'engage sur ${selected}`}
          disabled={busy || !profile.data}
          onPress={async () => {
            try {
              await setWeeklyGoal.mutateAsync(selected);
              if (editing) {
                router.back();
                return;
              }
              await merge.mutateAsync({ goal_confirmed_at: new Date().toISOString() });
              goNext();
            } catch {
              // Shown through ErrorNote.
            }
          }}
        />
      }
    >
      {GOALS.map((g) => (
        <OptionCard
          key={g.value}
          selected={selected === g.value}
          onPress={() => setGoal(g.value)}
          title={g.title}
          subtitle={g.subtitle}
        />
      ))}
      <Text variant="caption" color={colors.muted}>
        {`${selected} disques = ${selected * 20} kg chargés par toi sur la barre de la team chaque semaine.`}
      </Text>
      <ErrorNote message={error ? toUserMessage(error) : null} />
    </OnboardingScreen>
  );
}
