import { Redirect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SkipPoster } from '@/components/SkipPoster';
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

/** Development only: one SKIP poster style with sample data (?style=…), for visual QA. */
export default function DevPosters() {
  const style = useLocalSearchParams<{ style?: string }>().style ?? 'classic';
  if (!__DEV__) return <Redirect href="/" />;
  const Poster = POSTERS[style as keyof typeof POSTERS] ?? SkipPoster;
  return (
    <View style={styles.screen}>
      <Poster {...SAMPLE} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg, padding: 15 } });
