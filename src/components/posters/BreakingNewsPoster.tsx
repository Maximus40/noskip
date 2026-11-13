import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
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

import { type PosterProps, posterHeight, unit } from './types';

const NIGHT = '#101114';
const STUDIO = '#1B1D23';
const RED = '#E11D2E';
const ORANGE = '#FF6A3D';
const WHITE = '#F5F5F0';

/** « Alerte Info »: a news channel breaks the story, LIVE banner, ticker running at the bottom. */
export function BreakingNewsPoster({ ref, ...p }: PosterProps) {
  const reduced = useReducedMotion();
  const width = p.width;
  const height = posterHeight(width);
  const u = unit(width);
  const ticker = useSharedValue(0);

  useEffect(() => {
    if (p.animated === false || reduced) return;
    ticker.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1);
  }, [p.animated, reduced, ticker]);
  const tickerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -ticker.value * 560 * u }],
  }));
  const slide =
    p.animated === false ? undefined : reduced ? FadeIn : FadeInLeft.duration(420).delay(150);

  const tickerText = `+++ SKIP CONFIRMÉ : ${p.pseudo.toUpperCase()} +++ ${p.teamName.toUpperCase()} ${formatKg(p.teamKg)} KG +++ LE CANAP' ${p.skips} +++ `;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.poster, { width, height }]}
      accessible
      accessibilityLabel={`Carte SKIP, alerte info. ${p.pseudo} sèche la salle. ${p.line}`}
    >
      <View style={[styles.top, { padding: 20 * u, paddingBottom: 0 }]}>
        <View
          style={[
            styles.live,
            { paddingHorizontal: 8 * u, paddingVertical: 3 * u, borderRadius: 3 * u, gap: 5 * u },
          ]}
        >
          <View style={[styles.dot, { width: 7 * u, height: 7 * u, borderRadius: 4 * u }]} />
          <Text style={[styles.liveText, { fontSize: 11 * u, letterSpacing: 1.5 * u }]}>
            EN DIRECT
          </Text>
        </View>
        <Text style={[styles.brand, { fontSize: 13 * u, letterSpacing: -0.6 * u }]}>
          NOXCUSE<Text style={{ color: ORANGE }}>.</Text>
        </Text>
      </View>

      {/* Studio: the Canap' as the guest, on set. */}
      <View style={[styles.studio, { height: 300 * u, marginTop: 16 * u }]}>
        <View style={[styles.desk, { height: 54 * u }]} />
        <View style={[styles.canap, { left: 0, right: 0, bottom: 34 * u }]}>
          <Canap mood="wink" size={190 * u} accessible={false} />
        </View>
        <Text
          style={[
            styles.guest,
            { fontSize: 10 * u, letterSpacing: 1.5 * u, left: 20 * u, top: 16 * u },
          ]}
        >
          {"INVITÉ : LE CANAP', VAINQUEUR"}
        </Text>
      </View>

      <Animated.View
        entering={slide}
        style={[styles.banner, { paddingVertical: 8 * u, paddingHorizontal: 20 * u }]}
      >
        <Text style={[styles.bannerText, { fontSize: 16 * u, letterSpacing: 2 * u }]}>
          ALERTE INFO
        </Text>
      </Animated.View>
      <View style={[styles.headlineBox, { padding: 20 * u, paddingTop: 14 * u }]}>
        <Text
          style={[
            styles.headline,
            { fontSize: 34 * u, lineHeight: 36 * u, letterSpacing: -0.8 * u },
          ]}
          numberOfLines={3}
          adjustsFontSizeToFit
        >
          {`${p.pseudo.toUpperCase()} SÈCHE LA SALLE.`}
        </Text>
        <Text
          style={[styles.line, { fontSize: 14 * u, lineHeight: 19 * u, marginTop: 8 * u }]}
          numberOfLines={3}
        >
          {p.line}
        </Text>
        <Text style={[styles.meta, { fontSize: 10 * u, marginTop: 10 * u }]} numberOfLines={1}>
          {`${p.weekLabel} · ${p.inviteLabel}`}
        </Text>
      </View>

      <View style={{ flex: 1 }} />
      <View style={[styles.ticker, { height: 30 * u }]}>
        <View style={[styles.tickerTag, { paddingHorizontal: 10 * u }]}>
          <Text style={[styles.tickerTagText, { fontSize: 11 * u }]}>FLASH</Text>
        </View>
        <View style={styles.tickerTrack}>
          <Animated.Text
            numberOfLines={1}
            style={[styles.tickerText, { fontSize: 12 * u, width: 1200 * u }, tickerStyle]}
          >
            {tickerText + tickerText}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: NIGHT, overflow: 'hidden' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', backgroundColor: RED },
  dot: { backgroundColor: WHITE },
  liveText: { fontFamily: fonts.black, color: WHITE },
  brand: { fontFamily: fonts.black, color: WHITE },
  studio: { backgroundColor: STUDIO, overflow: 'hidden' },
  desk: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#2A2D35' },
  canap: { position: 'absolute', alignItems: 'center' },
  guest: { position: 'absolute', fontFamily: fonts.bold, color: '#9A9CA6' },
  banner: { backgroundColor: RED, alignSelf: 'flex-start' },
  bannerText: { fontFamily: fonts.black, color: WHITE },
  headlineBox: { backgroundColor: WHITE },
  headline: { fontFamily: fonts.expandedHeavy, color: NIGHT },
  line: { fontFamily: fonts.medium, color: '#33353B' },
  meta: { fontFamily: fonts.semibold, color: '#6B6D75' },
  ticker: { flexDirection: 'row', alignItems: 'center', backgroundColor: ORANGE },
  tickerTag: { height: '100%', justifyContent: 'center', backgroundColor: NIGHT },
  tickerTagText: { fontFamily: fonts.black, color: ORANGE, letterSpacing: 1 },
  tickerTrack: { flex: 1, overflow: 'hidden' },
  tickerText: { fontFamily: fonts.black, color: NIGHT, paddingLeft: 10 },
});
