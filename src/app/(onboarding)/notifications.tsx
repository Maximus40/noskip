import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { onboardingStepNumber } from '@/domain/onboarding';
import { registerForPush } from '@/features/notifications/push';
import { useUpdateLocalOnboarding } from '@/features/onboarding/localStore';
import { colors, radii, spacing } from '@/theme/tokens';

/** What the team actually sends: real copy from the Edge Functions. */
const EXAMPLES = [
  ['Disque chargé', 'Karim vient de charger 20 kg 💪'],
  ['Spot', 'Sofiane te spot : bouge à la salle !'],
  ['Dimanche, 20 h', "SKIP. Maxime a choisi le canap'."],
] as const;

/** Étape 9 : permission notifications. */
export default function NotificationsStep() {
  const [busy, setBusy] = useState(false);
  const markAsked = useUpdateLocalOnboarding();

  const next = () =>
    markAsked.mutate({ notificationsAsked: true }, { onSuccess: () => router.replace('/') });

  async function enable() {
    setBusy(true);
    try {
      // Whatever the answer, the step is done: the OS will not ask twice anyway.
      await registerForPush(true);
    } finally {
      setBusy(false);
      next();
    }
  }

  return (
    <OnboardingScreen
      step={onboardingStepNumber('/notifications')}
      title="Ta team bouge. Sois au courant."
      subtitle="Les disques, les spots, les cartes SKIP du dimanche. Tu choisis lesquelles dans les réglages."
      footer={
        <>
          <Button
            label="Activer les notifs"
            disabled={busy}
            onPress={enable}
            accessibilityHint="Le téléphone va te demander l'autorisation"
          />
          <Button label="Plus tard" variant="ghost" withArrow={false} onPress={next} />
        </>
      }
    >
      {EXAMPLES.map(([label, body]) => (
        <View key={label} style={styles.push} accessible accessibilityLabel={`${label} : ${body}`}>
          <View style={styles.dot} />
          <View style={styles.flex}>
            <Text variant="caption" color={colors.muted}>
              {`NOSKIP · ${label}`}
            </Text>
            <Text variant="bodyStrong">{body}</Text>
          </View>
        </View>
      ))}
      <Text variant="caption" color={colors.muted}>
        Jamais de pub, jamais de relance commerciale. Que ta team et le Canap&apos;.
      </Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  push: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
