import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, Keyframe, useReducedMotion } from 'react-native-reanimated';

import { Canap } from '@/components/Canap';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { fonts } from '@/theme/typography';

import { type PosterProps, posterHeight, unit } from './types';

const RED = '#C8102E';
const RED_DARK = '#8E0B20';
const WHITE = '#FFFFFF';
const INK = '#0E0E0F';

// The card is raised like a referee does: from below, with a snap.
const raise = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 120 }, { rotate: '-28deg' }] },
  70: { opacity: 1, transform: [{ translateY: -8 }, { rotate: '-9deg' }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { rotate: '-12deg' }] },
}).duration(520);

/** « Carton Rouge »: stadium red, a referee's card raised, the scoreboard at the bottom. */
export function RedCardPoster({ ref, ...p }: PosterProps) {
  const reduced = useReducedMotion();
  const width = p.width;
  const height = posterHeight(width);
  const u = unit(width);
  const card = p.animated === false ? undefined : reduced ? FadeIn : raise.delay(150);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.poster, { width, height, padding: 24 * u }]}
      accessible
      accessibilityLabel={`Carte SKIP, carton rouge. ${p.pseudo} quitte le terrain, le Canap' gagne. ${p.line}`}
    >
      {/* Pitch stripes. */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[styles.stripe, { top: i * 80 * u, height: 40 * u, opacity: i % 2 ? 0 : 0.18 }]}
        />
      ))}

      <View style={styles.row}>
        <Text style={[styles.small, { fontSize: 10 * u, letterSpacing: 1.6 * u }]}>
          {`90'+3 · ${p.weekLabel.toUpperCase()}`}
        </Text>
        <Text style={[styles.brand, { fontSize: 13 * u, letterSpacing: -0.6 * u }]}>
          NOXCUSE<Text style={{ color: INK }}>.</Text>
        </Text>
      </View>

      <Text
        style={[
          styles.huge,
          { fontSize: 68 * u, lineHeight: 64 * u, letterSpacing: -3 * u, marginTop: 18 * u },
        ]}
      >
        {'CARTON\nROUGE.'}
      </Text>

      <View style={[styles.cardZone, { height: 220 * u }]}>
        <Animated.View
          entering={card}
          style={[
            styles.card,
            {
              width: 128 * u,
              height: 178 * u,
              borderRadius: 10 * u,
              borderWidth: 5 * u,
              transform: [{ rotate: '-12deg' }],
              left: 28 * u,
              top: 26 * u,
            },
          ]}
        />
        <View style={[styles.canap, { right: -4 * u, bottom: 0 }]}>
          <Canap mood="laughing" size={150 * u} accessible={false} />
        </View>
      </View>

      <Text
        style={[styles.headline, { fontSize: 24 * u, lineHeight: 26 * u }]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {`${p.pseudo.toUpperCase()} QUITTE LE TERRAIN.`}
      </Text>
      <Text
        style={[styles.line, { fontSize: 14 * u, lineHeight: 19 * u, marginTop: 6 * u }]}
        numberOfLines={3}
      >
        {p.line}
      </Text>

      <View style={{ flex: 1 }} />
      <View style={[styles.board, { borderRadius: 8 * u, padding: 10 * u, gap: 8 * u }]}>
        <Text style={[styles.boardTeam, { fontSize: 10 * u }]} numberOfLines={2}>
          {p.teamName.toUpperCase()}
        </Text>
        <Text style={[styles.boardScore, { fontSize: 22 * u }]}>
          {`${formatKg(p.teamKg)} kg  –  ${p.skips}`}
        </Text>
        <Text style={[styles.boardTeam, { fontSize: 11 * u }]}>{"LE CANAP'"}</Text>
      </View>
      <Text style={[styles.small, { fontSize: 10 * u, marginTop: 10 * u }]} numberOfLines={1}>
        {p.inviteLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: RED, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, right: 0, backgroundColor: RED_DARK },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontFamily: fonts.bold, color: '#FFD9DE' },
  brand: { fontFamily: fonts.black, color: WHITE },
  huge: { fontFamily: fonts.black, color: WHITE, includeFontPadding: false },
  cardZone: { position: 'relative' },
  card: { position: 'absolute', backgroundColor: '#E8132F', borderColor: WHITE },
  canap: { position: 'absolute' },
  headline: { fontFamily: fonts.expandedHeavy, color: WHITE },
  line: { fontFamily: fonts.medium, color: '#FFE4E8' },
  board: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: INK,
  },
  boardTeam: { flex: 1, fontFamily: fonts.bold, color: '#C9CACE', textAlign: 'center' },
  boardScore: { fontFamily: fonts.expandedHeavy, color: '#FFD23F' },
});
