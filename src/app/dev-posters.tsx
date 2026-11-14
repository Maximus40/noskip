import { Redirect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Canap, type CanapMood } from '@/components/Canap';
import { StyledPoster } from '@/components/posters/StyledPoster';
import { Text } from '@/components/ui/Text';
import { isPosterStyle, SAMPLE_PSEUDO, sampleSkipLine } from '@/domain/shop';
import type { PosterProps } from '@/components/posters/types';
import { colors } from '@/theme/tokens';

const SAMPLE: PosterProps = {
  width: 360,
  pseudo: SAMPLE_PSEUDO,
  line: sampleSkipLine('leg-day'),
  teamName: 'Les Déchaînés',
  teamKg: 200,
  skips: 1,
  inviteLabel: 'Rejoins la team · code ABCD-2345',
  weekLabel: '26 oct. → 1er nov.',
  animated: false,
};

/** Development only: one SKIP poster style with sample data (?style=…, or ?style=moods for every
 * Canap' face), for visual QA. */
export default function DevPosters() {
  const style = useLocalSearchParams<{ style?: string }>().style ?? 'classic';
  if (!__DEV__) return <Redirect href="/" />;
  if (style === 'moods') return <Moods />;
  return (
    <View style={styles.screen}>
      <StyledPoster style={isPosterStyle(style) ? style : 'classic'} {...SAMPLE} />
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
