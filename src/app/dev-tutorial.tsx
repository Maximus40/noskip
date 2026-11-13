import { Redirect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TeamBar } from '@/components/TeamBar';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { RoundGlassButton } from '@/components/ui/RoundGlassButton';
import { Text } from '@/components/ui/Text';
import { HistoryIcon, TimerIcon } from '@/components/icons/GameIcons';
import { platesFor } from '@/domain/bar';
import { TEAM_TUTORIAL } from '@/domain/tutorial';
import { WELCOME_DEMO_TEAM } from '@/domain/welcome';
import { CoachMarks, CoachMarksProvider, useCoachTarget } from '@/features/tutorial/CoachMarks';
import { colors, radii, spacing } from '@/theme/tokens';

/** Development only: Ma team's layout with sample data and the tutorial (?step=n), for visual QA. */
export default function DevTutorial() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <CoachMarksProvider>
      <Sample />
    </CoachMarksProvider>
  );
}

function Sample() {
  const step = Number(useLocalSearchParams<{ step?: string }>().step) || 0;
  const bar = useCoachTarget('bar');
  const players = useCoachTarget('players');
  const session = useCoachTarget('session');
  const history = useCoachTarget('history');
  return (
    <View style={styles.screen}>
      <Text variant="number" style={styles.kg}>
        100 kg
      </Text>
      <View ref={bar} collapsable={false}>
        <GlassPanel radius={radii.glass} style={styles.panel}>
          <TeamBar
            plates={platesFor(WELCOME_DEMO_TEAM.players, colors.accent)}
            width={320}
            accessibilityLabel="Barre"
          />
        </GlassPanel>
      </View>
      <View ref={players} collapsable={false}>
        <GlassPanel radius={radii.glass} style={styles.panel}>
          {WELCOME_DEMO_TEAM.players.map((p) => (
            <Text key={p.id} variant="bodyStrong">{`${p.pseudo} · ${p.done}/${p.goal}`}</Text>
          ))}
        </GlassPanel>
      </View>
      <View style={styles.actions}>
        <View ref={history} collapsable={false}>
          <RoundGlassButton onPress={() => undefined} accessibilityLabel="Historique">
            <HistoryIcon color={colors.offWhite} />
          </RoundGlassButton>
        </View>
        <View ref={session} collapsable={false}>
          <RoundGlassButton
            size="main"
            accent
            onPress={() => undefined}
            accessibilityLabel="Séance"
          >
            <TimerIcon color={colors.accent} />
          </RoundGlassButton>
        </View>
        <View style={{ width: 50 }} />
      </View>
      <CoachMarks steps={TEAM_TUTORIAL.slice(step)} visible onDone={() => undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.map,
    padding: spacing.lg,
    gap: spacing.md,
    paddingTop: 60,
  },
  kg: { fontSize: 56, lineHeight: 60 },
  panel: { padding: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  actions: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
  },
});
