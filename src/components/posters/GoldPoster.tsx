import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

import { Canap } from '@/components/Canap';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { fonts } from '@/theme/typography';

import { type PosterProps, posterHeight, unit } from './types';

const BLACK = '#0B0B0C';
const GOLD = '#D9A441';
const GOLD_LIGHT = '#F6E39A';
const GOLD_DARK = '#8C6418';
const CREAM = '#F2E8CF';

/** « Édition Or »: black velvet, gold-leaf letters, a thin gold frame. The luxury edition. */
export function GoldPoster({ ref, ...p }: PosterProps) {
  const reduced = useReducedMotion();
  const width = p.width;
  const height = posterHeight(width);
  const u = unit(width);
  const enter = (d: number) =>
    p.animated === false ? undefined : reduced ? FadeIn : FadeInDown.delay(d).duration(500);
  const big = 188 * u;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.poster, { width, height }]}
      accessible
      accessibilityLabel={`Carte SKIP, édition or. ${p.pseudo} a choisi le Canap'. ${p.line}`}
    >
      <View
        pointerEvents="none"
        style={[styles.frame, { top: 12 * u, left: 12 * u, right: 12 * u, bottom: 12 * u }]}
      />
      <View
        pointerEvents="none"
        style={[styles.frameThin, { top: 17 * u, left: 17 * u, right: 17 * u, bottom: 17 * u }]}
      />

      <View style={{ flex: 1, padding: 30 * u }}>
        <View style={styles.row}>
          <Text style={[styles.small, { fontSize: 9 * u, letterSpacing: 2 * u }]}>
            {p.weekLabel.toUpperCase()}
          </Text>
          <Text style={[styles.brand, { fontSize: 13 * u, letterSpacing: -0.6 * u }]}>
            NOXCUSE<Text style={{ color: GOLD }}>.</Text>
          </Text>
        </View>

        <Animated.View entering={enter(80)} style={{ marginTop: 10 * u }}>
          <Svg width={300 * u} height={2 * 150 * u}>
            <Defs>
              <LinearGradient id="gold" x1="0" y1="0" x2="0.35" y2="1">
                <Stop offset="0" stopColor={GOLD_LIGHT} />
                <Stop offset="0.45" stopColor={GOLD} />
                <Stop offset="0.55" stopColor={GOLD_DARK} />
                <Stop offset="1" stopColor={GOLD} />
              </LinearGradient>
            </Defs>
            <SvgText
              x={-6 * u}
              y={140 * u}
              fill="url(#gold)"
              fontFamily={fonts.black}
              fontSize={big}
              letterSpacing={-10 * u}
            >
              SK
            </SvgText>
            <SvgText
              x={-6 * u}
              y={290 * u}
              fill="url(#gold)"
              fontFamily={fonts.black}
              fontSize={big}
              letterSpacing={-10 * u}
            >
              IP
            </SvgText>
          </Svg>
        </Animated.View>

        <View style={[styles.canap, { right: 24 * u, top: 278 * u }]}>
          <Canap mood="cool" size={104 * u} accessible={false} />
        </View>

        <View style={{ flex: 1 }} />
        <Text style={[styles.edition, { fontSize: 9 * u, letterSpacing: 3 * u }]}>
          ÉDITION OR · TIRAGE UNIQUE
        </Text>
        <Text
          style={[styles.headline, { fontSize: 23 * u, lineHeight: 26 * u, marginTop: 6 * u }]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {`${p.pseudo.toUpperCase()} A CHOISI LE CANAP'.`}
        </Text>
        <Text
          style={[styles.line, { fontSize: 14 * u, lineHeight: 19 * u, marginTop: 8 * u }]}
          numberOfLines={3}
        >
          {p.line}
        </Text>
        <View style={[styles.score, { marginTop: 16 * u, paddingTop: 12 * u }]}>
          <Text style={[styles.scoreText, { fontSize: 20 * u }]} numberOfLines={1}>
            {`${formatKg(p.teamKg)} KG`}
          </Text>
          <Text style={[styles.vs, { fontSize: 10 * u, letterSpacing: 2 * u }]}>CONTRE</Text>
          <Text style={[styles.scoreText, { fontSize: 20 * u }]}>{`${p.skips} SKIP`}</Text>
        </View>
        <Text style={[styles.small, { fontSize: 10 * u, marginTop: 12 * u }]} numberOfLines={1}>
          {p.inviteLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: BLACK, overflow: 'hidden' },
  frame: { position: 'absolute', borderWidth: 1.5, borderColor: GOLD },
  frameThin: { position: 'absolute', borderWidth: 0.5, borderColor: GOLD_DARK },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontFamily: fonts.semibold, color: '#A08A5A' },
  brand: { fontFamily: fonts.black, color: CREAM },
  canap: { position: 'absolute' },
  edition: { fontFamily: fonts.bold, color: GOLD },
  headline: { fontFamily: fonts.expandedHeavy, color: CREAM },
  line: { fontFamily: fonts.medium, color: '#CFC3A4' },
  score: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: GOLD,
  },
  scoreText: { fontFamily: fonts.expandedHeavy, color: GOLD },
  vs: { fontFamily: fonts.semibold, color: '#A08A5A' },
});
