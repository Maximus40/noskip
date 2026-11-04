import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Checkbox } from '@/components/ui/Checkbox';
import { Text } from '@/components/ui/Text';
import { onboardingStepNumber } from '@/domain/onboarding';
import { useAcceptAllRules } from '@/features/teams/api';
import { toUserMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/tokens';

const RULES = [
  ['Tu fixes ton objectif.', 'Chaque séance de 40 min à ta salle charge 20 kg sur la barre.'],
  ['Dimanche 20 h, on compte.', 'Objectif raté = carte SKIP envoyée à toute la team.'],
  ['On se chambre, on ne se blesse pas.', "Le Canap' se moque des excuses, jamais de la personne."],
  ['Un joker blessure par mois.', 'Déclaré avant dimanche 20 h : pas de carte, série préservée.'],
] as const;

export default function RulesStep() {
  const [accepted, setAccepted] = useState(false);
  const accept = useAcceptAllRules();

  return (
    <OnboardingScreen
      step={onboardingStepNumber('/rules')}
      title="Les règles de la team."
      footer={
        <Button
          label="Je signe"
          disabled={!accepted || accept.isPending}
          onPress={() => accept.mutate(undefined, { onSuccess: () => router.replace('/') })}
        />
      }
    >
      {RULES.map(([title, body], i) => (
        <View key={title} style={styles.rule}>
          <Text variant="number" color={colors.accent} style={styles.index}>
            {i + 1}
          </Text>
          <View style={styles.ruleText}>
            <Text variant="headline">{title}</Text>
            <Text variant="caption" color={colors.muted}>
              {body}
            </Text>
          </View>
        </View>
      ))}

      <View style={styles.check}>
        <Checkbox
          checked={accepted}
          onChange={setAccepted}
          label="J'accepte d'être chambré par le Canap' si je skip."
        />
      </View>
      <ErrorNote message={accept.error ? toUserMessage(accept.error) : null} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  rule: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  index: { width: 40, fontSize: 32, lineHeight: 36 },
  ruleText: { flex: 1, gap: 2, paddingTop: 4 },
  check: { marginTop: spacing.lg },
});
