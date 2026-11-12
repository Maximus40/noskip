import * as Location from 'expo-location';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { onboardingStepNumber } from '@/domain/onboarding';
import { useGymPoints } from '@/features/checkin/useCheckin';
import { syncGeofences } from '@/features/checkin/tasks';
import { useUpdateLocalOnboarding } from '@/features/onboarding/localStore';
import { colors, radii, spacing } from '@/theme/tokens';
import { useGoNext } from '@/features/onboarding/useGoNext';

type Outcome = 'always' | 'while_using' | 'denied' | null;

const PROMISES = [
  ['Ta team voit', '« venu » ou « pas venu ». Jamais où t’es, jamais à quelle heure.'],
  ['Le serveur reçoit', 'ta salle et tes horaires de séance. Aucune coordonnée GPS, aucun trajet.'],
  [
    'Ton téléphone vérifie',
    'que t’es à moins de 150 m de ta salle. Le calcul reste sur ton téléphone.',
  ],
] as const;

export default function LocationStep() {
  const goNext = useGoNext();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  const markAsked = useUpdateLocalOnboarding();
  const { gyms } = useGymPoints();

  const done = () => markAsked.mutate({ locationAsked: true }, { onSuccess: () => goNext() });

  async function ask() {
    setBusy(true);
    try {
      // iOS and Android both want "while using" first, then "always".
      const fg = await Location.requestForegroundPermissionsAsync();
      if (!fg.granted) {
        setOutcome('denied');
        return;
      }
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.granted) {
        await syncGeofences(gyms).catch(() => undefined);
        setOutcome('always');
      } else {
        setOutcome('while_using');
      }
    } finally {
      setBusy(false);
    }
  }

  if (outcome) {
    const copy = {
      always: [
        'Pointage auto activé.',
        'Va à la salle, reste 40 minutes, le disque se charge tout seul.',
      ],
      while_using: [
        'Pointage manuel.',
        'Sans « Toujours », touche « Je suis à la salle » en arrivant, puis valide 40 minutes plus tard. Tu peux activer « Toujours » quand tu veux dans les réglages.',
      ],
      denied: [
        'Localisation refusée.',
        'Sans elle, impossible de compter tes séances. Active-la dans les réglages de ton téléphone pour charger la barre.',
      ],
    }[outcome];
    return (
      <OnboardingScreen
        step={onboardingStepNumber('/location')}
        title={copy[0]}
        subtitle={copy[1]}
        footer={
          <>
            <Button label="Continuer" onPress={done} />
            {outcome !== 'always' ? (
              <Button
                label="Ouvrir les réglages"
                variant="ghost"
                withArrow={false}
                onPress={() => Linking.openSettings()}
              />
            ) : null}
          </>
        }
      />
    );
  }

  return (
    <OnboardingScreen
      step={onboardingStepNumber('/location')}
      title="On vérifie juste que t'es à la salle."
      subtitle={'Ta team voit « venu » ou « pas venu », jamais où t’es.'}
      footer={
        <Button
          label="Activer le pointage auto"
          disabled={busy}
          onPress={ask}
          accessibilityHint="Le téléphone va te demander la localisation, choisis « Toujours »"
        />
      }
    >
      {PROMISES.map(([title, body]) => (
        <View key={title} style={styles.card}>
          <Text variant="label" color={colors.accent}>
            {title}
          </Text>
          <Text variant="body">{body}</Text>
        </View>
      ))}
      <Text variant="caption" color={colors.muted}>
        Quand ton téléphone le propose, choisis « Toujours » : c&apos;est ce qui permet de pointer
        sans sortir le téléphone de ta poche.
      </Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.xs,
  },
});
