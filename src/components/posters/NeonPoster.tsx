import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Canap } from '@/components/Canap';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { fonts } from '@/theme/typography';

import { type PosterProps, posterHeight, unit } from './types';

const NIGHT = '#0B0A0F';
const PINK = '#FF4FA3';
const TUBE = '#FFD6EA';

/** « Néon »: a pink neon sign in the night. The gym sign is off, the Canap' club is open. */
export function NeonPoster({ ref, ...p }: PosterProps) {
  const reduced = useReducedMotion();
  const width = p.width;
  const height = posterHeight(width);
  const u = unit(width);
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (p.animated === false || reduced) return;
    // A tired neon tube: mostly on, two quick drops now and then.
    flicker.value = withRepeat(
      withDelay(
        2200,
        withSequence(
          withTiming(0.25, { duration: 60 }),
          withTiming(1, { duration: 80 }),
          withTiming(0.4, { duration: 60 }),
          withTiming(1, { duration: 120 }),
        ),
      ),
      -1,
    );
  }, [flicker, p.animated, reduced]);
  const flickerStyle = useAnimatedStyle(() => ({ opacity: flicker.value }));

  const glow = {
    textShadowColor: PINK,
    textShadowRadius: 18 * u,
    textShadowOffset: { width: 0, height: 0 },
  };
  const big = { fontSize: 188 * u, lineHeight: 166 * u, letterSpacing: -8 * u };

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.poster, { width, height, padding: 22 * u }]}
      accessible
      accessibilityLabel={`Carte SKIP, néon. Ce soir, ${p.pseudo} reste au Canap'. ${p.line}`}
    >
      <View style={styles.row}>
        <Text style={[styles.small, { fontSize: 9 * u, letterSpacing: 2 * u }]}>
          {p.weekLabel.toUpperCase()}
        </Text>
        <Text style={[styles.brand, { fontSize: 13 * u, letterSpacing: -0.6 * u }]}>
          NOXCUSE<Text style={{ color: PINK }}>.</Text>
        </Text>
      </View>

      <View
        style={[
          styles.sign,
          {
            marginTop: 14 * u,
            paddingHorizontal: 10 * u,
            paddingVertical: 4 * u,
            borderRadius: 6 * u,
          },
        ]}
      >
        <Text style={[styles.signText, glow, { fontSize: 12 * u, letterSpacing: 3 * u }]}>
          SALLE : FERMÉE
        </Text>
      </View>

      <Animated.View style={[{ marginTop: 6 * u }, flickerStyle]}>
        <Text style={[styles.big, glow, big]}>SK</Text>
        <Text style={[styles.big, glow, big]}>IP</Text>
      </Animated.View>
      <View style={[styles.canap, { right: 14 * u, top: 300 * u }]}>
        <Canap mood="laughing" size={128 * u} accessible={false} />
      </View>

      <Text
        style={[styles.headline, glow, { fontSize: 21 * u, lineHeight: 25 * u, marginTop: 12 * u }]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {`CE SOIR, ${p.pseudo.toUpperCase()} RESTE AU CANAP'.`}
      </Text>
      <Text
        style={[styles.line, { fontSize: 14 * u, lineHeight: 19 * u, marginTop: 6 * u }]}
        numberOfLines={3}
      >
        {p.line}
      </Text>
      <View style={{ flex: 1 }} />
      <Text style={[styles.score, glow, { fontSize: 16 * u }]} numberOfLines={1}>
        {`${formatKg(p.teamKg)} KG  ·  CANAP' ${p.skips}`}
      </Text>
      <Text style={[styles.small, { fontSize: 10 * u, marginTop: 8 * u }]} numberOfLines={1}>
        {`${p.teamName} · ${p.inviteLabel}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: NIGHT, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontFamily: fonts.semibold, color: '#9C8A96' },
  brand: { fontFamily: fonts.black, color: '#F5F5F0' },
  sign: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: PINK },
  signText: { fontFamily: fonts.black, color: TUBE },
  big: { fontFamily: fonts.black, color: TUBE, includeFontPadding: false },
  canap: { position: 'absolute' },
  headline: { fontFamily: fonts.expandedHeavy, color: TUBE },
  line: { fontFamily: fonts.medium, color: '#CBBFC8' },
  score: { fontFamily: fonts.expandedHeavy, color: TUBE },
});
