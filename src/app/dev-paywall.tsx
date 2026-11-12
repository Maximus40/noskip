import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlanCard } from '@/components/PlanCard';
import { TeamBar } from '@/components/TeamBar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { platesFor } from '@/domain/bar';
import { crewLine, ctaLabel, renewalNotice } from '@/domain/paywall';
import { colors, radii, spacing } from '@/theme/tokens';
import { APP_NAME } from '../../content/brand';

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

const teamPlan = {
  key: 'team',
  priceString: '149,99 €',
  price: 149.99,
  currency: 'EUR',
  period: 'P1Y',
  trialDays: null,
} as const;

/**
 * Development-only: the paywall layout (same blocks as src/app/paywall.tsx) with sample store
 * prices, for visual QA and the App Store review screenshot of the subscriptions.
 */
export default function DevPaywall() {
  // ?plan=weekly | team: that plan selected (team also opens "Plus de 4 joueurs ?").
  const plan = useLocalSearchParams<{ plan?: string }>().plan;
  const showTeam = plan === 'team';
  const [selected, setSelected] = useState<'annual' | 'weekly' | 'team'>(
    plan === 'team' || plan === 'weekly' ? plan : 'annual',
  );
  if (!__DEV__) return <Redirect href="/" />;
  const option = selected === 'team' ? teamPlan : plans.find((p) => p.key === selected)!;
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
          <View style={styles.links}>
            {['Restaurer mes achats', 'CGU', 'Confidentialité'].map((l) => (
              <Text key={l} variant="caption" style={styles.link}>
                {l}
              </Text>
            ))}
          </View>
        </>
      }
    >
      <Text variant="label" color={colors.accent}>
        {APP_NAME} Pro
      </Text>
      <Text variant="display" style={styles.title}>
        CHOISIS LES DIPS.
      </Text>
      {showTeam ? null : (
        <View style={styles.barCard}>
          <Text variant="caption" color={colors.muted} style={styles.stretch}>
            Ta team · Les Déchaînés
          </Text>
          <TeamBar plates={plates} width={320} accessibilityLabel="Barre" />
          <Text variant="caption" color="#C9CACE">
            La barre se charge. Ton disque manque.
          </Text>
        </View>
      )}
      <View style={styles.crew}>
        <Text variant="label" color={colors.accent}>
          Un pote paie, toute la team joue
        </Text>
        <Text variant="body">{crewLine(['Karim'])}</Text>
      </View>
      {plans.map((p) => (
        <PlanCard
          key={p.key}
          option={p}
          selected={selected === p.key}
          onPress={() => setSelected(p.key)}
        />
      ))}
      {showTeam ? (
        <>
          <View style={styles.friendsRow}>
            <Text variant="bodyStrong">Plus de 4 joueurs ?</Text>
            <Text variant="bodyStrong" color={colors.accent}>
              −
            </Text>
          </View>
          <PlanCard
            option={teamPlan}
            selected={selected === 'team'}
            onPress={() => setSelected('team')}
            detail="Toute la team « Les Déchaînés » joue, jusqu’à 8 joueurs."
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  legal: { fontSize: 11, lineHeight: 15 },
  stretch: { alignSelf: 'stretch' },
  crew: {
    borderRadius: radii.card,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  friendsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.xs,
  },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  link: { textDecorationLine: 'underline' },
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
