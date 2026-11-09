import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanCard } from '@/components/PlanCard';
import { TeamBar } from '@/components/TeamBar';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { PressableScale } from '@/components/ui/PressableScale';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { ctaLabel, renewalNotice } from '@/domain/paywall';
import {
  paymentsAvailable,
  setDevProBypass,
  usePlans,
  usePurchase,
  useRestore,
} from '@/features/subscriptions/api';
import { useMyTeams, useTeamBoard } from '@/features/teams/api';
import { useBarState } from '@/features/teams/useBarState';
import { toUserMessage } from '@/lib/errors';
import { queryClient } from '@/lib/queryClient';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

/**
 * Écran de paiement (hard paywall, flat dark cards): a first look at the team bar, annual
 * (default, best offer) or weekly, "Avec tes potes" (Pack Duo, Team), restore. No way around it.
 */
export default function PaywallScreen() {
  const reduced = useReducedMotion();
  const teams = useMyTeams();
  const [teamIndex, setTeamIndex] = useState(0);
  const team = teams.data?.[Math.min(teamIndex, (teams.data?.length ?? 1) - 1)];
  const board = useTeamBoard(team?.id);
  const [now] = useState(() => Date.now());
  const bar = useBarState(board.data, now);
  const plans = usePlans();
  const buy = usePurchase();
  const restore = useRestore();
  const [selected, setSelected] = useState<'annual' | 'weekly' | 'duo' | 'team'>('annual');
  const [showFriends, setShowFriends] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const all = [...(plans.data?.solo ?? []), ...(plans.data?.friends ?? [])];
  const option = all.find((o) => o.key === selected) ?? plans.data?.solo[0] ?? null;
  const teammates = (board.data ?? []).filter((r) => !r.is_me);
  const partner = partnerId ?? teammates[0]?.user_id ?? null;
  const enter = (i: number) => (reduced ? FadeIn : FadeInDown.delay(i * 90).duration(400));

  async function onBuy() {
    if (!option) return;
    setMessage(null);
    try {
      const result = await buy.mutateAsync({
        option,
        partnerId: option.key === 'duo' ? partner : null,
        teamId: option.key === 'team' ? (team?.id ?? null) : null,
      });
      if (result === 'unlocked') router.replace('/');
      else if (result === 'pending') {
        setMessage('Paiement en cours de validation par le store. Ça arrive dans un instant.');
      }
    } catch (err) {
      setMessage(toUserMessage(err));
    }
  }

  async function onRestore() {
    setMessage(null);
    try {
      const ok = await restore.mutateAsync();
      if (ok) router.replace('/');
      else setMessage('Aucun abonnement actif trouvé sur ce compte store.');
    } catch (err) {
      setMessage(toUserMessage(err));
    }
  }

  async function devContinue() {
    await setDevProBypass(true);
    await queryClient.invalidateQueries();
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={enter(0)} style={styles.head}>
          <Text variant="label" color={colors.accent}>
            NoSkip Pro
          </Text>
          <Text variant="display" style={styles.title} accessibilityRole="header">
            PASSE EN MODE NOSKIP.
          </Text>
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.barCard}>
          <View style={styles.barHead}>
            <Text variant="caption" color={colors.muted} numberOfLines={1} style={styles.flex}>
              {team ? `Ta team · ${team.name}` : 'Ta team'}
            </Text>
            <Text variant="bodyStrong" style={styles.expanded}>
              {bar ? `${formatKg(bar.kg)} kg` : ''}
            </Text>
          </View>
          {bar ? (
            <TeamBar
              plates={bar.plates}
              width={320}
              accessibilityLabel={`Barre de ta team : ${bar.kg} kilos cette semaine`}
            />
          ) : (
            <Skeleton height={90} />
          )}
          <Text variant="caption" color="#C9CACE">
            {bar && bar.kg > 0
              ? 'La barre se charge. Ton disque manque.'
              : 'La barre attend ton premier disque. Le Canap’ aussi.'}
          </Text>
        </Animated.View>

        {(teams.data?.length ?? 0) > 1 ? (
          <View style={styles.chips}>
            {teams.data!.map((t, i) => (
              <Chip
                key={t.id}
                label={t.name}
                active={i === teamIndex}
                onPress={() => {
                  setTeamIndex(i);
                  setPartnerId(null);
                }}
              />
            ))}
          </View>
        ) : null}

        {!paymentsAvailable() ? (
          <View style={styles.card}>
            <Text variant="bodyStrong">
              Le paiement n’est pas encore branché dans cette version.
            </Text>
            <Text variant="caption" color={colors.muted}>
              Les offres arrivent dès que la boutique est configurée.
            </Text>
            {__DEV__ ? (
              <Button
                label="Continuer sans payer (dev)"
                variant="ghost"
                withArrow={false}
                onPress={devContinue}
              />
            ) : null}
          </View>
        ) : plans.isLoading ? (
          <View style={styles.gap} accessibilityLabel="Chargement des offres">
            <Skeleton height={120} />
            <Skeleton height={96} />
          </View>
        ) : plans.error || !option ? (
          <View style={styles.card}>
            <ErrorNote
              message={plans.error ? toUserMessage(plans.error) : 'Aucune offre disponible.'}
            />
            <Button
              label="Réessayer"
              variant="secondary"
              withArrow={false}
              onPress={() => plans.refetch()}
            />
          </View>
        ) : (
          <Animated.View entering={enter(2)} style={styles.gap} accessibilityRole="radiogroup">
            {plans.data!.solo.map((o) => (
              <PlanCard
                key={o.key}
                option={o}
                selected={selected === o.key}
                onPress={() => setSelected(o.key)}
              />
            ))}

            <PressableScale
              onPress={() => setShowFriends((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Avec tes potes"
              accessibilityHint="Pack Duo et offre Team"
              accessibilityState={{ expanded: showFriends }}
              style={styles.friendsToggle}
            >
              <Text variant="bodyStrong">Avec tes potes</Text>
              <Text variant="bodyStrong" color={colors.accent}>
                {showFriends ? '−' : '+'}
              </Text>
            </PressableScale>

            {showFriends
              ? plans.data!.friends.map((o) => (
                  <View key={o.key} style={styles.gap}>
                    <PlanCard
                      option={o}
                      selected={selected === o.key}
                      onPress={() => setSelected(o.key)}
                      detail={
                        o.key === 'duo'
                          ? 'Pro pour toi et un pote de ta team.'
                          : `Pro pour toute la team${team ? ` « ${team.name} »` : ''}, jusqu’à 8 joueurs.`
                      }
                    />
                    {o.key === 'duo' && selected === 'duo' ? (
                      teammates.length ? (
                        <View style={styles.chips}>
                          {teammates.map((m) => (
                            <Chip
                              key={m.user_id}
                              label={`Offrir à ${m.pseudo ?? 'un pote'}`}
                              active={partner === m.user_id}
                              onPress={() => setPartnerId(m.user_id)}
                            />
                          ))}
                        </View>
                      ) : (
                        <Text variant="caption" color={colors.muted}>
                          Pas encore de pote dans ta team : le premier qui la rejoint en profitera.
                        </Text>
                      )
                    ) : null}
                  </View>
                ))
              : null}
          </Animated.View>
        )}

        <ErrorNote message={message} />
      </ScrollView>

      {option && paymentsAvailable() ? (
        <View style={styles.footer}>
          <Button
            label={buy.isPending ? 'Un instant…' : ctaLabel(option.trialDays)}
            onPress={onBuy}
            disabled={buy.isPending || restore.isPending}
          />
          <Text variant="caption" color={colors.muted} style={styles.legal}>
            {renewalNotice({
              priceString: option.priceString,
              period: option.period,
              trialDays: option.trialDays,
              platform: Platform.OS === 'ios' ? 'ios' : 'android',
            })}
          </Text>
          <View style={styles.links}>
            <LinkButton label="Restaurer mes achats" onPress={onRestore} />
            <LinkButton label="CGU" onPress={() => router.push('/terms')} />
            <LinkButton label="Confidentialité" onPress={() => router.push('/privacy')} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text variant="caption" color={active ? colors.ink : colors.offWhite}>
        {label}
      </Text>
    </PressableScale>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="link" style={styles.link}>
      <Text variant="caption" color={colors.offWhite} style={styles.underline}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  friendsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: minTouch,
    paddingHorizontal: spacing.xs,
  },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  head: { gap: spacing.sm, marginTop: spacing.sm },
  title: { fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  expanded: { fontFamily: 'Archivo-ExpandedBold' },
  barCard: {
    borderRadius: radii.cardLarge,
    backgroundColor: '#1A1B1F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  barHead: { flexDirection: 'row', alignSelf: 'stretch', gap: spacing.sm },
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipActive: { backgroundColor: colors.offWhite, borderColor: colors.offWhite },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  legal: { fontSize: 11, lineHeight: 15 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  link: { minHeight: minTouch, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
