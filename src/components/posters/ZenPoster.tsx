import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Canap } from '@/components/Canap';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { fonts } from '@/theme/typography';

import { FitLine } from './FitLine';
import { type PosterProps, posterHeight, unit } from './types';

const SAGE_PAPER = '#E5E9DD';
const SAGE = '#8DA68F';
const SAGE_LIGHT = '#CBD8C8';
const INK = '#2E3A30';

/** « Zen »: a yoga class poster. Breathe in, breathe out, skip. The Canap' meditates (asleep). */
export function ZenPoster({ ref, ...p }: PosterProps) {
  const reduced = useReducedMotion();
  const width = p.width;
  const height = posterHeight(width);
  const u = unit(width);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (p.animated === false || reduced) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath, p.animated, reduced]);
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.07 * breath.value }] }));

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.poster, { width, height, padding: 24 * u }]}
      accessible
      accessibilityLabel={`Carte SKIP, zen. Inspire, expire, skip. ${p.pseudo} a trouvé la paix intérieure sur le Canap'. ${p.line}`}
    >
      <View style={styles.row}>
        <Text style={[styles.small, { fontSize: 9 * u, letterSpacing: 2 * u }]}>
          {`MÉDITATION · ${p.weekLabel.toUpperCase()}`}
        </Text>
        <Text style={[styles.brand, { fontSize: 13 * u, letterSpacing: -0.6 * u }]}>
          NOXCUSE<Text style={{ color: SAGE }}>.</Text>
        </Text>
      </View>

      <View style={{ marginTop: 18 * u }}>
        {[
          ['INSPIRE.', SAGE],
          ['EXPIRE.', SAGE],
          ['SKIP.', INK],
        ].map(([word, color]) => (
          <FitLine
            key={word}
            style={[
              styles.word,
              { color, fontSize: 50 * u, lineHeight: 52 * u, letterSpacing: -1 * u },
            ]}
          >
            {word}
          </FitLine>
        ))}
      </View>

      <View style={[styles.circleZone, { height: 220 * u }]}>
        <Animated.View
          style={[styles.halo, { width: 200 * u, height: 200 * u, borderRadius: 100 * u }, halo]}
        />
        <Canap mood="sleepy" size={150 * u} accessible={false} />
      </View>

      <Text
        style={[styles.headline, { fontSize: 19 * u, lineHeight: 23 * u }]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {`${p.pseudo.toUpperCase()} A TROUVÉ LA PAIX. SUR LE CANAP'.`}
      </Text>
      <Text
        style={[styles.line, { fontSize: 14 * u, lineHeight: 19 * u, marginTop: 6 * u }]}
        numberOfLines={3}
      >
        {p.line}
      </Text>
      <View style={{ flex: 1 }} />
      <Text style={[styles.small, { fontSize: 10 * u, letterSpacing: 1 * u }]} numberOfLines={1}>
        {`${p.teamName.toUpperCase()} ${formatKg(p.teamKg)} KG · CANAP' ${p.skips} · NAMASTÉ`}
      </Text>
      <Text style={[styles.small, { fontSize: 10 * u, marginTop: 6 * u }]} numberOfLines={1}>
        {p.inviteLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: SAGE_PAPER, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontFamily: fonts.semibold, color: '#5E6B5F' },
  brand: { fontFamily: fonts.black, color: INK },
  word: { fontFamily: fonts.expandedHeavy },
  circleZone: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: SAGE_LIGHT },
  headline: { fontFamily: fonts.expandedHeavy, color: INK },
  line: { fontFamily: fonts.medium, color: '#47544A' },
});
