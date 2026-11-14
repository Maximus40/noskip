import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, Keyframe, useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { Canap } from '@/components/Canap';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { fonts } from '@/theme/typography';

import { type PosterProps, posterHeight, unit } from './types';

const NIGHT = '#121110';
const EMBER = '#FF7A2F';
const BRONZE = '#C08A4A';
const BONE = '#F2EBDD';

const slam = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 2.4 }, { rotate: '-20deg' }] },
  70: { opacity: 1, transform: [{ scale: 0.94 }, { rotate: '-7deg' }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '-8deg' }] },
}).duration(420);

/** « Warrior »: the arena is ready, the warrior never came. Hollow letters, a FORFAIT stamp. */
export function WarriorPoster({ ref, ...p }: PosterProps) {
  const reduced = useReducedMotion();
  const width = p.width;
  const height = posterHeight(width);
  const u = unit(width);
  const stampIn = p.animated === false ? undefined : reduced ? FadeIn : slam.delay(350);
  const big = 112 * u;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.poster, { width, height, padding: 22 * u }]}
      accessible
      accessibilityLabel={`Carte SKIP, warrior. ${p.pseudo} déclare forfait. ${p.line}`}
    >
      {/* Embers glowing from the arena floor. */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <RadialGradient id="ember" cx="50%" cy="100%" rx="80%" ry="45%">
            <Stop offset="0" stopColor={EMBER} stopOpacity={0.45} />
            <Stop offset="1" stopColor={EMBER} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#ember)" />
      </Svg>

      <View style={styles.row}>
        <Text style={[styles.small, { fontSize: 9 * u, letterSpacing: 2 * u }]}>
          {`ARÈNE · ${p.weekLabel.toUpperCase()}`}
        </Text>
        <Text style={[styles.brand, { fontSize: 13 * u, letterSpacing: -0.6 * u }]}>
          NOXCUSE<Text style={{ color: EMBER }}>.</Text>
        </Text>
      </View>

      <View style={{ marginTop: 8 * u }}>
        <Svg width={316 * u} height={214 * u}>
          {['WAR', 'RIOR'].map((word, i) => (
            <SvgText
              key={word}
              x={-4 * u}
              y={(98 + i * 104) * u}
              fill="none"
              stroke={BRONZE}
              strokeWidth={3.4 * u}
              fontFamily={fonts.black}
              fontSize={big}
              letterSpacing={-5 * u}
            >
              {word}
            </SvgText>
          ))}
        </Svg>
        <Animated.View
          entering={stampIn}
          style={[
            styles.stamp,
            {
              top: 82 * u,
              left: 40 * u,
              paddingHorizontal: 14 * u,
              paddingVertical: 4 * u,
              borderRadius: 4 * u,
              transform: [{ rotate: '-8deg' }],
            },
          ]}
        >
          <Text style={[styles.stampText, { fontSize: 40 * u, letterSpacing: 1 * u }]}>
            FORFAIT
          </Text>
        </Animated.View>
      </View>

      <View style={[styles.arena, { height: 150 * u }]}>
        <Svg width={150 * u} height={150 * u} viewBox="0 0 100 100" style={styles.shield}>
          <Path
            d="M50 4 L92 18 L88 58 Q80 84 50 96 Q20 84 12 58 L8 18 Z"
            fill="#1E1B18"
            stroke={BRONZE}
            strokeWidth={2}
          />
        </Svg>
        <Canap mood="cool" size={140 * u} accessible={false} />
      </View>

      <Text
        style={[styles.headline, { fontSize: 23 * u, lineHeight: 26 * u, marginTop: 6 * u }]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {`${p.pseudo.toUpperCase()} DÉCLARE FORFAIT.`}
      </Text>
      <Text
        style={[styles.line, { fontSize: 14 * u, lineHeight: 19 * u, marginTop: 6 * u }]}
        numberOfLines={3}
      >
        {p.line}
      </Text>

      <View style={{ flex: 1 }} />
      <View style={[styles.score, { borderRadius: 6 * u, paddingVertical: 9 * u, gap: 6 * u }]}>
        <Text style={[styles.scoreSide, { fontSize: 13 * u }]} numberOfLines={1}>
          {`${formatKg(p.teamKg)} KG`}
        </Text>
        <Text style={[styles.vs, { fontSize: 10 * u, letterSpacing: 2 * u }]}>VS</Text>
        <Text style={[styles.scoreSide, { fontSize: 13 * u }]}>{`CANAP' ${p.skips}`}</Text>
      </View>
      <Text style={[styles.small, { fontSize: 10 * u, marginTop: 10 * u }]} numberOfLines={1}>
        {`${p.teamName} · ${p.inviteLabel}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: NIGHT, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontFamily: fonts.semibold, color: '#B49C80' },
  brand: { fontFamily: fonts.black, color: BONE },
  stamp: { position: 'absolute', backgroundColor: EMBER },
  stampText: { fontFamily: fonts.black, color: NIGHT },
  arena: { alignItems: 'center', justifyContent: 'center' },
  shield: { position: 'absolute' },
  headline: { fontFamily: fonts.expandedHeavy, color: BONE },
  line: { fontFamily: fonts.medium, color: '#CFC4B2' },
  score: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1.5,
    borderColor: BRONZE,
  },
  scoreSide: { fontFamily: fonts.expandedHeavy, color: EMBER },
  vs: { fontFamily: fonts.bold, color: BRONZE },
});
