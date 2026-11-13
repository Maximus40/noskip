import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Canap } from '@/components/Canap';
import { CountUp } from '@/components/CountUp';
import { TeamBar } from '@/components/TeamBar';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatKg, personalBarKg, plateLoadedLine } from '@/domain/bar';
import { feedback } from '@/features/feedback/feedback';
import { useProfile } from '@/features/profile/api';
import { useDuoStreak, useMyTeams, useTeamBoard } from '@/features/teams/api';
import { useBarState } from '@/features/teams/useBarState';
import { useTeamSkins } from '@/features/shop/api';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

/** "Disque chargé" (design/html/V3-Disque.html): flat dark cards, the moment of the day. */
export default function PlateLoadedScreen() {
  const params = useLocalSearchParams<{
    duration?: string;
    done?: string;
    goal?: string;
    lifetime?: string;
  }>();
  const duration = Number(params.duration ?? 0);
  const done = Number(params.done ?? 1);
  const goal = Number(params.goal ?? 3);
  const lifetime = Number(params.lifetime ?? 1);

  const profile = useProfile();
  const teams = useMyTeams();
  const team = teams.data?.[0];
  const board = useTeamBoard(team?.id);
  const duo = useDuoStreak(team?.id);
  const [now] = useState(() => Date.now());
  const skins = useTeamSkins(team?.id);
  const state = useBarState(board.data, now, skins.data);
  const reduced = useReducedMotion();
  const me = state?.players.find((p) => p.isMe);
  const newKey = me && me.done > 0 ? `${me.id}-${me.done - 1}` : null;
  const isDuo = (state?.players.length ?? 0) === 2;

  useEffect(() => {
    if (!profile.data) return;
    feedback('plate_loaded', {
      sound: profile.data.sound_enabled,
      haptics: profile.data.haptics_enabled,
    });
  }, [profile.data]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/team'));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.top}>
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

      <Animated.View entering={reduced ? FadeIn : FadeInDown.duration(420)} style={styles.hero}>
        <Text variant="label" color={colors.accent} style={styles.heroLabel}>
          Aujourd&apos;hui / Séance validée
        </Text>
        <Text
          variant="display"
          style={styles.big}
          accessibilityRole="header"
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          +20 KG.
        </Text>
        <Text variant="body" color="#C9CACE">
          {plateLoadedLine(done, goal)}
        </Text>
        <View style={styles.cta}>
          <Button label="VOIR LA BARRE" onPress={() => router.replace('/team')} />
        </View>
      </Animated.View>

      <Animated.View
        entering={reduced ? FadeIn : FadeInDown.delay(120).duration(420)}
        style={styles.stats}
      >
        <Stat value={`${duration} min`} label="Sur place" />
        <View style={styles.stat}>
          <CountUp
            variant="headline"
            style={styles.statValue}
            value={personalBarKg(lifetime)}
            format={formatKg}
          />
          <Text variant="caption" color={colors.muted}>
            Kg sur ta barre
          </Text>
        </View>
        {isDuo ? (
          <Stat value={`${duo.data?.current_weeks ?? 0} sem.`} label="Série duo" alignEnd />
        ) : (
          <Stat value={`${done}/${goal}`} label="Cette semaine" alignEnd />
        )}
      </Animated.View>

      <Animated.View
        entering={reduced ? FadeIn : FadeInDown.delay(220).duration(420)}
        style={styles.barCard}
      >
        <View style={styles.barHeader}>
          <Text variant="caption" color={colors.muted}>
            Barre de la team
          </Text>
          <Text variant="bodyStrong" style={styles.expanded}>
            {state ? `${formatKg(state.kg)} kg` : ''}
          </Text>
        </View>
        {state ? (
          <TeamBar
            plates={state.plates}
            newPlateKey={newKey}
            width={320}
            accessibilityLabel="Barre de la team : ton nouveau disque vient d'être chargé"
          />
        ) : (
          <View style={styles.barPlaceholder} />
        )}
      </Animated.View>

      <View style={styles.flex} />

      <View style={styles.canapRow}>
        <Canap mood="sad" size={84} accessible={false} />
        <Text variant="body" color="#C9CACE" style={styles.flex}>
          <Text variant="bodyStrong">Le Canap&apos;</Text> boude.{'\n'}« Même pas un petit skip ? »
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Stat({ value, label, alignEnd }: { value: string; label: string; alignEnd?: boolean }) {
  return (
    <View style={[styles.stat, alignEnd && styles.statEnd]}>
      <Text variant="headline" style={styles.statValue}>
        {value}
      </Text>
      <Text variant="caption" color={colors.muted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  flex: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: spacing.sm },
  close: {
    width: Math.max(minTouch, 48),
    height: Math.max(minTouch, 48),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    marginTop: 14,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    paddingTop: 20,
    gap: 10,
  },
  heroLabel: { fontSize: 13, letterSpacing: 0.8 },
  big: { fontSize: 84, lineHeight: 84, letterSpacing: -2.5 },
  cta: { marginTop: spacing.sm },
  stats: { marginTop: 18, flexDirection: 'row', paddingHorizontal: 4, gap: spacing.sm },
  stat: { flex: 1, gap: 2 },
  statEnd: { alignItems: 'flex-end' },
  statValue: { fontSize: 24, lineHeight: 28 },
  expanded: { fontFamily: 'Archivo-ExpandedBold' },
  barCard: {
    marginTop: 20,
    borderRadius: radii.cardLarge,
    backgroundColor: '#1A1B1F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: spacing.lg,
    paddingHorizontal: 14,
    gap: 6,
    alignItems: 'center',
  },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  barPlaceholder: { height: 100 },
  canapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 4,
    paddingBottom: spacing.md,
  },
});
