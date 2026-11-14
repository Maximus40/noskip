import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { Canap } from '@/components/Canap';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { fonts } from '@/theme/typography';

import { type PosterProps, posterHeight, unit } from './types';

const BLUSH = '#F4DCD6';
const INK = '#1A1414';
const PINK = '#E2366B';

/** « Couverture »: a glossy magazine cover, the Canap' is the cover star, the skip is the exclusive. */
export function MagazinePoster({ ref, ...p }: PosterProps) {
  const reduced = useReducedMotion();
  const width = p.width;
  const height = posterHeight(width);
  const u = unit(width);
  const pop = p.animated === false ? undefined : reduced ? FadeIn : ZoomIn.springify().delay(400);
  // Barcode: fixed pattern of bar widths.
  const bars = [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1];

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.poster, { width, height, padding: 18 * u }]}
      accessible
      accessibilityLabel={`Carte SKIP, couverture de magazine. Exclu : ${p.pseudo} dit non à la salle. ${p.line}`}
    >
      <View style={styles.row}>
        <Text style={[styles.small, { fontSize: 9 * u, letterSpacing: 1.6 * u }]}>
          {`N° ${p.weekLabel.toUpperCase()} · ÉDITION SKIP`}
        </Text>
        <Text style={[styles.brand, { fontSize: 12 * u, letterSpacing: -0.5 * u }]}>
          NOXCUSE<Text style={{ color: PINK }}>.</Text>
        </Text>
      </View>
      <Text
        style={[
          styles.masthead,
          { fontSize: 78 * u, lineHeight: 80 * u, letterSpacing: -4 * u, marginTop: 4 * u },
        ]}
      >
        {"CANAP'"}
      </Text>

      <View style={[styles.cover, { height: 310 * u }]}>
        <View style={[styles.star, { right: -30 * u, bottom: 0 }]}>
          <Canap mood="wink" size={270 * u} accessible={false} />
        </View>
        <View style={{ width: 170 * u, gap: 4 * u, marginTop: 6 * u }}>
          <Text style={[styles.kicker, { fontSize: 11 * u, letterSpacing: 2 * u }]}>EXCLU</Text>
          <Text
            style={[styles.coverline, { fontSize: 21 * u, lineHeight: 23 * u }]}
            numberOfLines={4}
            adjustsFontSizeToFit
          >
            {`${p.pseudo.toUpperCase()} DIT NON À LA SALLE`}
          </Text>
          <Text style={[styles.minor, { fontSize: 11 * u, lineHeight: 14 * u, marginTop: 8 * u }]}>
            Le look plaid de la saison
          </Text>
          <Text style={[styles.minor, { fontSize: 11 * u, lineHeight: 14 * u }]}>
            Dips ou chips ?
          </Text>
        </View>
        <Animated.View
          entering={pop}
          style={[
            styles.sticker,
            {
              width: 78 * u,
              height: 78 * u,
              borderRadius: 39 * u,
              right: 6 * u,
              top: 4 * u,
              transform: [{ rotate: '12deg' }],
            },
          ]}
        >
          <Text style={[styles.stickerBig, { fontSize: 20 * u, lineHeight: 21 * u }]}>100 %</Text>
          <Text style={[styles.stickerSmall, { fontSize: 11 * u, letterSpacing: 1 * u }]}>
            SKIP
          </Text>
        </Animated.View>
      </View>

      <Text
        style={[styles.line, { fontSize: 14 * u, lineHeight: 19 * u, marginTop: 8 * u }]}
        numberOfLines={3}
      >
        {p.line}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={[styles.footer, { gap: 10 * u }]}>
        <View style={[styles.barcode, { height: 30 * u, gap: 1.5 * u, padding: 4 * u }]}>
          {bars.map((w, i) => (
            <View key={i} style={{ width: w * 1.3 * u, backgroundColor: INK }} />
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.small, { fontSize: 10 * u }]} numberOfLines={1}>
            {`${p.teamName} ${formatKg(p.teamKg)} kg · Canap' ${p.skips}`}
          </Text>
          <Text style={[styles.small, { fontSize: 10 * u }]} numberOfLines={1}>
            {p.inviteLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: BLUSH, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontFamily: fonts.semibold, color: '#5E4A48' },
  brand: { fontFamily: fonts.black, color: INK },
  masthead: { fontFamily: fonts.black, color: INK, textAlign: 'center', includeFontPadding: false },
  cover: { position: 'relative' },
  star: { position: 'absolute' },
  kicker: { fontFamily: fonts.black, color: PINK },
  coverline: { fontFamily: fonts.expandedHeavy, color: INK },
  minor: { fontFamily: fonts.semibold, color: INK },
  sticker: {
    position: 'absolute',
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerBig: { fontFamily: fonts.black, color: '#FFFFFF' },
  stickerSmall: { fontFamily: fonts.bold, color: '#FFFFFF' },
  line: { fontFamily: fonts.medium, color: '#3A2C2B' },
  footer: { flexDirection: 'row', alignItems: 'center' },
  barcode: { flexDirection: 'row', backgroundColor: '#FFFFFF' },
});
