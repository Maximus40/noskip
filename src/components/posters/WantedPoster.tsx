import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, Keyframe, useReducedMotion } from 'react-native-reanimated';

import { Canap } from '@/components/Canap';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { fonts } from '@/theme/typography';

import { type PosterProps, posterHeight, unit } from './types';

const PAPER = '#E9DAB4';
const PAPER_DARK = '#D2BE8E';
const INK = '#2B1D0E';
const STAMP = '#C8331A';

const stamp = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 2.2 }, { rotate: '-30deg' }] },
  65: { opacity: 1, transform: [{ scale: 0.92 }, { rotate: '-14deg' }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '-16deg' }] },
}).duration(420);

/** « Avis de recherche »: Wild West poster, the runaway's portrait, a SKIP stamp. */
export function WantedPoster({ ref, ...p }: PosterProps) {
  const reduced = useReducedMotion();
  const width = p.width;
  const height = posterHeight(width);
  const u = unit(width);
  const stampIn = p.animated === false ? undefined : reduced ? FadeIn : stamp.delay(500);
  const initial = (p.pseudo.trim()[0] ?? '?').toUpperCase();

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.poster, { width, height, padding: 22 * u }]}
      accessible
      accessibilityLabel={`Carte SKIP, avis de recherche. ${p.pseudo} recherché pour séance manquée. ${p.line}`}
    >
      <View
        pointerEvents="none"
        style={[
          styles.border,
          { top: 10 * u, left: 10 * u, right: 10 * u, bottom: 10 * u, borderWidth: 3 * u },
        ]}
      />
      {/* Worn corners. */}
      {[
        { top: 0, left: 0 },
        { top: 0, right: 0 },
        { bottom: 0, left: 0 },
        { bottom: 0, right: 0 },
      ].map((pos, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[styles.corner, pos, { width: 34 * u, height: 34 * u }]}
        />
      ))}

      <View style={styles.row}>
        <Text style={[styles.small, { fontSize: 9 * u, letterSpacing: 2 * u }]}>
          {p.weekLabel.toUpperCase()}
        </Text>
        <Text style={[styles.brand, { fontSize: 12 * u, letterSpacing: -0.5 * u }]}>
          NOXCUSE<Text style={{ color: STAMP }}>.</Text>
        </Text>
      </View>

      <Text style={[styles.title, { fontSize: 46 * u, letterSpacing: -1 * u, marginTop: 14 * u }]}>
        RECHERCHÉ
      </Text>
      <Text style={[styles.sub, { fontSize: 13 * u, letterSpacing: 4 * u, marginTop: 8 * u }]}>
        POUR SÉANCE MANQUÉE
      </Text>

      <View style={[styles.portrait, { height: 230 * u, marginTop: 16 * u, borderWidth: 3 * u }]}>
        <Text style={[styles.initial, { fontSize: 150 * u, lineHeight: 160 * u }]}>{initial}</Text>
        <View style={[styles.canap, { right: 6 * u, bottom: 4 * u }]}>
          <Canap mood="smug" size={92 * u} accessible={false} />
        </View>
        <Animated.View
          entering={stampIn}
          style={[
            styles.stamp,
            {
              left: 18 * u,
              top: 70 * u,
              borderWidth: 4 * u,
              borderRadius: 6 * u,
              paddingHorizontal: 12 * u,
              transform: [{ rotate: '-16deg' }],
            },
          ]}
        >
          <Text style={[styles.stampText, { fontSize: 44 * u, letterSpacing: 2 * u }]}>SKIP</Text>
        </Animated.View>
      </View>

      <Text
        style={[styles.name, { fontSize: 34 * u, lineHeight: 38 * u, marginTop: 12 * u }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {p.pseudo.toUpperCase()}
      </Text>
      <Text
        style={[styles.line, { fontSize: 14 * u, lineHeight: 19 * u, marginTop: 4 * u }]}
        numberOfLines={3}
      >
        {`Vu pour la dernière fois sur le Canap'. ${p.line}`}
      </Text>

      <View style={{ flex: 1 }} />
      <View
        style={[
          styles.reward,
          { paddingVertical: 8 * u, borderTopWidth: 2 * u, borderBottomWidth: 2 * u },
        ]}
      >
        <Text style={[styles.rewardLabel, { fontSize: 11 * u, letterSpacing: 2 * u }]}>
          RÉCOMPENSE
        </Text>
        <Text style={[styles.rewardValue, { fontSize: 22 * u }]}>UNE SÉANCE</Text>
      </View>
      <Text
        style={[styles.small, { fontSize: 10 * u, marginTop: 10 * u, textAlign: 'center' }]}
        numberOfLines={2}
      >
        {`${p.teamName} ${formatKg(p.teamKg)} kg · le Canap' ${p.skips}\n${p.inviteLabel}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: PAPER, overflow: 'hidden' },
  border: { position: 'absolute', borderColor: INK },
  corner: { position: 'absolute', backgroundColor: PAPER_DARK, opacity: 0.7 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontFamily: fonts.semibold, color: '#5A4528' },
  brand: { fontFamily: fonts.black, color: INK },
  title: { fontFamily: fonts.black, color: INK, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, color: INK, textAlign: 'center' },
  portrait: {
    backgroundColor: PAPER_DARK,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontFamily: fonts.black, color: '#7A6338', opacity: 0.55 },
  canap: { position: 'absolute' },
  stamp: { position: 'absolute', borderColor: STAMP },
  stampText: { fontFamily: fonts.black, color: STAMP },
  name: { fontFamily: fonts.black, color: INK, textAlign: 'center' },
  line: { fontFamily: fonts.medium, color: '#4A3820', textAlign: 'center' },
  reward: { alignItems: 'center', borderColor: INK },
  rewardLabel: { fontFamily: fonts.bold, color: '#5A4528' },
  rewardValue: { fontFamily: fonts.expandedHeavy, color: INK },
});
