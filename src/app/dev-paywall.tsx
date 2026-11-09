import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlanCard } from '@/components/PlanCard';
import { TeamBar } from '@/components/TeamBar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { platesFor } from '@/domain/bar';
import { ctaLabel, renewalNotice } from '@/domain/paywall';
import { colors, radii, spacing } from '@/theme/tokens';

const plans = [
  {
    key: 'annual',
    priceString: '59,99 €',
    price: 59.99,
    currency: 'EUR',
    period: 'P1Y',
    trialDays: 7,
  },
  {
    key: 'weekly',
    priceString: '4,99 €',
    price: 4.99,
    currency: 'EUR',
    period: 'P1W',
    trialDays: 3,
  },
] as const;

/** Development-only: the paywall layout with sample store prices, for visual QA. */
export default function DevPaywall() {
  const [selected, setSelected] = useState<'annual' | 'weekly'>('annual');
  if (!__DEV__) return <Redirect href="/" />;
  const option = plans.find((p) => p.key === selected)!;
  const plates = platesFor(
    [
      {
        id: 'k',
        pseudo: 'Karim',
        color: '#B9BBC0',
        isMe: false,
        goal: 3,
        done: 2,
        status: 'done',
        joker: false,
      },
      {
        id: 'me',
        pseudo: 'Toi',
        color: '#F5F5F0',
        isMe: true,
        goal: 3,
        done: 0,
        status: 'not_yet',
        joker: false,
      },
    ],
    colors.accent,
  );
  return (
    <Screen
      footer={
        <>
          <Button label={ctaLabel(option.trialDays)} onPress={() => undefined} />
          <Text variant="caption" color={colors.muted} style={styles.legal}>
            {renewalNotice({ ...option, platform: 'ios' })}
          </Text>
        </>
      }
    >
      <Text variant="label" color={colors.accent}>
        NoSkip Pro
      </Text>
      <Text variant="display" style={styles.title}>
        PASSE EN MODE NOSKIP.
      </Text>
      <View style={styles.barCard}>
        <Text variant="caption" color={colors.muted} style={styles.stretch}>
          Ta team · Les Déchaînés
        </Text>
        <TeamBar plates={plates} width={320} accessibilityLabel="Barre" />
        <Text variant="caption" color="#C9CACE">
          La barre se charge. Ton disque manque.
        </Text>
      </View>
      {plans.map((p) => (
        <PlanCard
          key={p.key}
          option={p}
          selected={selected === p.key}
          onPress={() => setSelected(p.key)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  legal: { fontSize: 11, lineHeight: 15 },
  stretch: { alignSelf: 'stretch' },
  barCard: {
    borderRadius: radii.cardLarge,
    backgroundColor: '#1A1B1F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
});
