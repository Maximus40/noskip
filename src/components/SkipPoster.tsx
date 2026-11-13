import type { ComponentRef, Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, Keyframe, useReducedMotion } from 'react-native-reanimated';

import { Canap } from '@/components/Canap';
import { Wordmark } from '@/components/Wordmark';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

type Props = {
  width: number;
  pseudo: string;
  line: string;
  teamName: string;
  teamKg: number;
  skips: number;
  inviteLabel: string;
  weekLabel: string;
  /** Stamp animation ("SK" then "IP"). Off for the off-screen capture. */
  animated?: boolean;
  ref?: Ref<ComponentRef<typeof View>>;
};

const POSTER_INK = '#0E0E0F';
const POSTER_GREY = '#55565B';

// "SK" then "IP" drop like a rubber stamp: big and transparent → slammed in place.
const stamp = (delay: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 1.8 }, { rotate: '-4deg' }] },
    70: { opacity: 1, transform: [{ scale: 0.94 }, { rotate: '0.5deg' }] },
    100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
  })
    .duration(380)
    .delay(delay);

/**
 * "Affiche" (direction artistique §3.3): paper #ECECE8, giant stacked black letters, the
 * monochrome Canap' sniggering in place of the athlete, a single orange point (its chips).
 * 9:16 so the capture becomes a 1080×1920 story image.
 */
export function SkipPoster({
  width,
  pseudo,
  line,
  teamName,
  teamKg,
  skips,
  inviteLabel,
  weekLabel,
  animated = true,
  ref,
}: Props) {
  const reduced = useReducedMotion();
  const height = Math.round((width * 16) / 9);
  const u = width / 360; // design unit: the poster is drawn for a 360-wide canvas
  const letters = { fontSize: 192 * u, lineHeight: 158 * u, letterSpacing: -10 * u };
  const enter = (delay: number) =>
    !animated ? undefined : reduced ? FadeIn.duration(200) : stamp(delay);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.poster, { width, height, padding: 22 * u }]}
      accessible
      accessibilityLabel={`Carte SKIP. ${pseudo} a choisi le Canap'. ${line} ${teamName} ${formatKg(teamKg)} kilos, le Canap' ${skips}.`}
    >
      <View style={styles.top}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.week, { fontSize: 10 * u, letterSpacing: 0.8 * u }]}
        >
          {weekLabel.toUpperCase()}
        </Text>
        <Wordmark size={14 * u} color={POSTER_INK} style={styles.logo} />
      </View>

      <View style={[styles.letters, { marginTop: 6 * u }]}>
        <Animated.Text entering={enter(80)} style={[styles.letter, letters]}>
          SK
        </Animated.Text>
        <Animated.Text entering={enter(420)} style={[styles.letter, letters]}>
          IP
        </Animated.Text>
      </View>

      <View style={[styles.canap, { right: 0, top: 268 * u }]}>
        <Canap mood="smug" size={116 * u} accessible={false} />
      </View>

      <View style={styles.flex} />

      <Text
        style={[styles.headline, { fontSize: 24 * u, lineHeight: 26 * u, letterSpacing: -0.4 * u }]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {`${pseudo.toUpperCase()} A CHOISI LE CANAP'.`}
      </Text>
      <Text
        style={[styles.line, { fontSize: 15 * u, lineHeight: 20 * u, marginTop: 8 * u }]}
        numberOfLines={3}
      >
        {line}
      </Text>

      <View style={[styles.score, { marginTop: 18 * u, paddingTop: 12 * u }]}>
        <View style={styles.flex}>
          <Text style={[styles.scoreLabel, { fontSize: 11 * u }]} numberOfLines={1}>
            {teamName}
          </Text>
          <Text style={[styles.scoreValue, { fontSize: 26 * u, lineHeight: 30 * u }]}>
            {`${formatKg(teamKg)} kg`}
          </Text>
        </View>
        <Text style={[styles.slash, { fontSize: 26 * u, lineHeight: 30 * u }]}>/</Text>
        <View style={[styles.flex, styles.right]}>
          <Text style={[styles.scoreLabel, { fontSize: 11 * u }]}>{"Le Canap'"}</Text>
          <Text style={[styles.scoreValue, { fontSize: 26 * u, lineHeight: 30 * u }]}>
            {String(skips)}
          </Text>
        </View>
      </View>

      <Text style={[styles.invite, { fontSize: 11 * u, marginTop: 14 * u }]} numberOfLines={1}>
        {inviteLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: colors.paper, overflow: 'hidden' },
  flex: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  week: { flexShrink: 1, fontFamily: fonts.semibold, color: POSTER_GREY },
  logo: { flexShrink: 0 },
  letters: { alignItems: 'flex-start' },
  letter: { fontFamily: fonts.black, color: POSTER_INK, includeFontPadding: false },
  canap: { position: 'absolute' },
  headline: { fontFamily: fonts.expandedHeavy, color: POSTER_INK },
  line: { fontFamily: fonts.medium, color: '#2A2B2F' },
  score: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1.5,
    borderTopColor: POSTER_INK,
  },
  right: { alignItems: 'flex-end' },
  scoreLabel: { fontFamily: fonts.semibold, color: POSTER_GREY, textTransform: 'uppercase' },
  scoreValue: { fontFamily: fonts.expandedHeavy, color: POSTER_INK },
  slash: { fontFamily: fonts.expanded, color: POSTER_GREY, paddingHorizontal: 10 },
  invite: { fontFamily: fonts.semibold, color: POSTER_INK },
});
