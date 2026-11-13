import { Redirect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Canap, type CanapMood } from '@/components/Canap';
import { SkipPoster } from '@/components/SkipPoster';
import { Text } from '@/components/ui/Text';
import { BreakingNewsPoster } from '@/components/posters/BreakingNewsPoster';
import { GameOverPoster } from '@/components/posters/GameOverPoster';
import { GoldPoster } from '@/components/posters/GoldPoster';
import { RedCardPoster } from '@/components/posters/RedCardPoster';
import type { PosterProps } from '@/components/posters/types';
import { WantedPoster } from '@/components/posters/WantedPoster';
import { colors } from '@/theme/tokens';

const SAMPLE: PosterProps = {
  width: 360,
  pseudo: 'Karim',
  line: "Karim a skip la salle. Même le leg day n'y croyait plus.",
  teamName: 'Les Déchaînés',
  teamKg: 200,
  skips: 1,
  inviteLabel: 'Rejoins la team · code ABCD-2345',
  weekLabel: '26 oct. → 1er nov.',
  animated: false,
};

const POSTERS = {
  classic: SkipPoster,
  gold: GoldPoster,
  redcard: RedCardPoster,
  gameover: GameOverPoster,
  wanted: WantedPoster,
  news: BreakingNewsPoster,
} as const;

/** Development only: one SKIP poster style with sample data (?style=…, or ?style=moods for every
 * Canap' face), for visual QA. */
export default function DevPosters() {
  const style = useLocalSearchParams<{ style?: string }>().style ?? 'classic';
  if (!__DEV__) return <Redirect href="/" />;
  if (style === 'moods') return <Moods />;
  const Poster = POSTERS[style as keyof typeof POSTERS] ?? SkipPoster;
  return (
    <View style={styles.screen}>
      <Poster {...SAMPLE} />
    </View>
  );
}

const MOODS: CanapMood[] = [
  'idle',
  'smug',
  'sad',
  'crushed',
  'laughing',
  'cool',
  'evil',
  'sleepy',
  'wink',
];

function Moods() {
  return (
    <View style={[styles.screen, styles.grid]}>
      {MOODS.map((m) => (
        <View key={m} style={styles.cell}>
          <Canap mood={m} size={110} />
          <Text>{m}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 115, alignItems: 'center', paddingVertical: 6 },
});
