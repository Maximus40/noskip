import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Canap } from '@/components/Canap';
import { CountUp } from '@/components/CountUp';
import { TeamBar } from '@/components/TeamBar';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { PressableScale } from '@/components/ui/PressableScale';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { type BarPlayer, formatKg, platesFor } from '@/domain/bar';
import { initialsOf } from '@/domain/profile';
import { recapStatus, weekRangeLabel } from '@/domain/weekClose';
import { feedback } from '@/features/feedback/feedback';
import { useProfile } from '@/features/profile/api';
import { useDuoStreak } from '@/features/teams/api';
import { type RecapPlayer, useWeekRecap } from '@/features/weeks/api';
import { toUserMessage } from '@/lib/errors';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

/** Bilan du dimanche (flat dark cards): kilos, Team vs Canap', machine, skipper, PR, series. */
export default function RecapScreen() {
  const { weekId } = useLocalSearchParams<{ weekId: string }>();
  const recap = useWeekRecap(weekId);
  const profile = useProfile();
  const reduced = useReducedMotion();
  const data = recap.data;
  const duo = useDuoStreak(data && data.players.length === 2 ? data.teamId : undefined);

  const isPr = data?.isTeamPr ?? false;
  useEffect(() => {
    if (!isPr || !profile.data) return;
    feedback('team_pr', {
      sound: profile.data.sound_enabled,
      haptics: profile.data.haptics_enabled,
    });
  }, [isPr, profile.data]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/team'));
  const enter = (i: number) => (reduced ? FadeIn : FadeInDown.delay(i * 90).duration(400));

  const machine = data?.players.find((p) => p.userId === data.machineId);
  const skipper = data?.players.find((p) => p.userId === data.skipperId);
  const cards = data?.players.filter((p) => p.cardId) ?? [];
  const barPlayers: BarPlayer[] =
    data?.players.map((p) => ({
      id: p.userId,
      pseudo: p.pseudo,
      color: p.plateColor,
      isMe: p.isMe,
      goal: p.goal,
      done: p.done,
      status: 'not_yet',
      joker: p.usedJoker,
    })) ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text variant="label" color={colors.muted} numberOfLines={1} style={styles.flex}>
          {data ? data.teamName : 'Bilan'}
        </Text>
        <PressableScale
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={styles.close}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6 6l12 12M18 6L6 18"
              stroke={colors.accent}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          </Svg>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!data ? (
          recap.isError ? null : (
            <View style={styles.gap} accessibilityLabel="Chargement du bilan">
              <Skeleton height={200} />
              <Skeleton height={96} />
              <Skeleton height={180} />
            </View>
          )
        ) : (
          <>
            <Animated.View entering={enter(0)} style={styles.hero}>
              <Text variant="label" color={colors.accent} style={styles.heroLabel}>
                {`Bilan du dimanche / ${weekRangeLabel(data.weekStart)}`}
              </Text>
              <View style={styles.kgRow}>
                <CountUp
                  variant="display"
                  style={styles.big}
                  value={data.totalKg}
                  format={formatKg}
                  accessibilityLabel={`${data.totalKg} kilos soulevés`}
                />
                <Text variant="title" style={styles.bigUnit}>
                  KG.
                </Text>
              </View>
              <Text variant="body" color="#C9CACE">
                {data.isTeamPr
                  ? data.isRecord
                    ? 'PR de la team et record battu. Le Canap’ ne s’en remet pas.'
                    : 'Tout le monde a tenu. La team a soulevé la barre.'
                  : data.skipsCount === 0
                    ? 'Zéro skip. Le Canap’ boude dans son coin.'
                    : `${data.skipsCount} skip${data.skipsCount > 1 ? 's' : ''} cette semaine. Le Canap’ marque des points.`}
              </Text>
            </Animated.View>

            <Animated.View entering={enter(1)} style={styles.scoreCard}>
              <View style={styles.flex}>
                <Text variant="caption" color={colors.muted} numberOfLines={1}>
                  {data.teamName}
                </Text>
                <Text variant="title" style={styles.scoreValue}>
                  {`${formatKg(data.totalKg)} kg`}
                </Text>
              </View>
              <Text variant="title" color={colors.muted}>
                /
              </Text>
              <View style={[styles.flex, styles.end]}>
                <Text variant="caption" color={colors.muted}>
                  Le Canap&apos;
                </Text>
                <Text
                  variant="title"
                  style={styles.scoreValue}
                  color={data.skipsCount > 0 ? colors.accent : colors.offWhite}
                >
                  {String(data.skipsCount)}
                </Text>
              </View>
            </Animated.View>

            <Animated.View entering={enter(2)} style={styles.barCard}>
              {data.isTeamPr ? (
                <View style={styles.prRow}>
                  <Canap mood="crushed" size={84} />
                  <Text variant="headline" style={styles.flex}>
                    {data.isRecord ? 'PR de la team. Record battu.' : 'PR de la team.'}
                  </Text>
                </View>
              ) : null}
              <TeamBar
                plates={platesFor(barPlayers, colors.accent)}
                width={320}
                accessibilityLabel={`Barre de la semaine : ${data.totalKg} kilos`}
              />
            </Animated.View>

            <Animated.View entering={enter(3)} style={styles.duoRow}>
              <Award
                label="Machine de la semaine"
                value={machine?.pseudo ?? 'Personne'}
                detail={
                  machine ? `${machine.done} séance${machine.done > 1 ? 's' : ''}` : 'Barre vide'
                }
              />
              <Award
                label="Skippeur de la semaine"
                value={skipper?.pseudo ?? 'Personne'}
                detail={skipper ? `${skipper.done}/${skipper.goal}` : 'Aucun skip'}
                accent={Boolean(skipper)}
              />
            </Animated.View>

            {data.players.length === 2 && duo.data ? (
              <Animated.View entering={enter(4)} style={styles.card}>
                <Text variant="caption" color={colors.muted}>
                  Série duo
                </Text>
                <Text variant="title">{`${duo.data.current_weeks} sem.`}</Text>
                <Text variant="caption" color={colors.muted}>
                  {`Record : ${duo.data.best_weeks} sem.`}
                </Text>
              </Animated.View>
            ) : null}

            <Animated.View entering={enter(5)} style={styles.card}>
              {data.players.map((p) => (
                <RecapRow key={p.userId} player={p} />
              ))}
            </Animated.View>

            {cards.map((p) => (
              <Button
                key={p.cardId}
                label={p.isMe ? 'VOIR MA CARTE SKIP' : `VOIR LA CARTE DE ${p.pseudo.toUpperCase()}`}
                variant={cards.length === 1 ? 'primary' : 'secondary'}
                onPress={() =>
                  router.push({ pathname: '/skip/[id]', params: { id: p.cardId as string } })
                }
              />
            ))}
            {cards.length === 0 ? (
              <Button label="RETOUR À LA BARRE" onPress={() => router.replace('/team')} />
            ) : null}
          </>
        )}
        <ErrorNote message={recap.error ? toUserMessage(recap.error) : null} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Award({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <View
      style={[styles.card, styles.flex]}
      accessible
      accessibilityLabel={`${label} : ${value}, ${detail}`}
    >
      <Text variant="caption" color={colors.muted}>
        {label}
      </Text>
      <Text variant="headline" numberOfLines={1} color={accent ? colors.accent : colors.offWhite}>
        {value}
      </Text>
      <Text variant="caption" color={colors.muted}>
        {detail}
      </Text>
    </View>
  );
}

function RecapRow({ player }: { player: RecapPlayer }) {
  const status = recapStatus(player);
  const tint = player.isMe ? colors.accent : player.plateColor;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${player.pseudo}${player.isMe ? ' (toi)' : ''}, ${player.done} sur ${player.goal}, ${status.label}`}
    >
      <View style={[styles.avatar, { borderColor: tint }]}>
        <Text variant="bodyStrong" color={player.isMe ? colors.accent : colors.offWhite}>
          {initialsOf(player.pseudo)}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {player.isMe ? `${player.pseudo} (toi)` : player.pseudo}
        </Text>
        <Text
          variant="caption"
          color={status.tone === 'skip' ? colors.accent : colors.muted}
          numberOfLines={1}
        >
          {status.label}
        </Text>
      </View>
      <Text variant="headline">{`${player.done}/${player.goal}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  end: { alignItems: 'flex-end' },
  gap: { gap: spacing.md },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  close: {
    width: 48,
    height: Math.max(minTouch, 48),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: {
    borderRadius: radii.cardLarge,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    paddingTop: 20,
    gap: 10,
  },
  heroLabel: { fontSize: 13, letterSpacing: 0.8 },
  kgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  big: { fontSize: 72, lineHeight: 76, letterSpacing: -2.5 },
  bigUnit: { paddingBottom: 10 },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  scoreValue: { fontSize: 28, lineHeight: 32 },
  barCard: {
    borderRadius: radii.cardLarge,
    backgroundColor: '#1A1B1F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: spacing.lg,
    paddingHorizontal: 14,
    gap: spacing.sm,
    alignItems: 'center',
  },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'stretch' },
  duoRow: { flexDirection: 'row', gap: spacing.md },
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
  },
});
