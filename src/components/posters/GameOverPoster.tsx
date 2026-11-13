import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Canap } from '@/components/Canap';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { fonts } from '@/theme/typography';

import { type PosterProps, posterHeight, unit } from './types';

const SCREEN = '#0A0A0F';
const WHITE = '#F5F5F0';
const ORANGE = '#FF6A3D';
const CYAN = '#5EF2E4';
const GREEN = '#7CFF6B';

/** « Game Over »: arcade screen, CRT scanlines, hearts lost, the Canap' wins the round. */
export function GameOverPoster({ ref, ...p }: PosterProps) {
  const reduced = useReducedMotion();
  const width = p.width;
  const height = posterHeight(width);
  const u = unit(width);
  const blink = useSharedValue(1);

  useEffect(() => {
    if (p.animated === false || reduced) return;
    blink.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1 }),
        withTiming(0, { duration: 450 }),
        withTiming(1, { duration: 1 }),
        withTiming(1, { duration: 450 }),
      ),
      -1,
    );
  }, [blink, p.animated, reduced]);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  const big = { fontSize: 84 * u, lineHeight: 80 * u, letterSpacing: -3 * u };
  const enter =
    p.animated === false ? undefined : reduced ? FadeIn : ZoomIn.duration(420).delay(120);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.poster, { width, height, padding: 24 * u }]}
      accessible
      accessibilityLabel={`Carte SKIP, game over. ${p.pseudo} battu par le Canap'. ${p.line}`}
    >
      {Array.from({ length: Math.ceil(height / (4 * u)) }, (_, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[styles.scan, { top: i * 4 * u, height: 1.2 * u }]}
        />
      ))}

      <View style={styles.row}>
        <Text
          style={[styles.hud, { fontSize: 11 * u, color: CYAN }]}
        >{`1UP  ${p.pseudo.toUpperCase()}`}</Text>
        <Text style={[styles.hud, { fontSize: 11 * u }]}>{`HI  ${formatKg(p.teamKg)}`}</Text>
      </View>
      <View style={[styles.hearts, { marginTop: 8 * u, gap: 6 * u }]}>
        {[true, true, false].map((full, i) => (
          <Heart key={i} size={14 * u} full={full} />
        ))}
        <View style={{ flex: 1 }} />
        <Text style={[styles.brand, { fontSize: 13 * u, letterSpacing: -0.6 * u }]}>
          NOXCUSE<Text style={{ color: ORANGE }}>.</Text>
        </Text>
      </View>

      <Animated.View entering={enter} style={{ marginTop: 22 * u }}>
        {/* Orange offset copy behind: the arcade 3D shadow. */}
        <Text style={[styles.big, big, styles.shadow, { left: 5 * u, right: -5 * u, top: 5 * u }]}>
          {'GAME\nOVER.'}
        </Text>
        <Text style={[styles.big, big]}>{'GAME\nOVER.'}</Text>
      </Animated.View>

      <View style={[styles.canapRow, { marginTop: 8 * u }]}>
        <View style={{ flex: 1, gap: 6 * u }}>
          <Text style={[styles.hud, { fontSize: 12 * u, color: GREEN }]}>{"BOSS : LE CANAP'"}</Text>
          <Text
            style={[styles.hud, { fontSize: 12 * u }]}
          >{`PV RESTANTS : ${'█'.repeat(10)}`}</Text>
        </View>
        <Canap mood="evil" size={150 * u} accessible={false} />
      </View>

      <Text
        style={[styles.headline, { fontSize: 21 * u, lineHeight: 25 * u, marginTop: 10 * u }]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {`${p.pseudo.toUpperCase()} A PERDU CONTRE LE CANAP'.`}
      </Text>
      <Text
        style={[styles.line, { fontSize: 14 * u, lineHeight: 19 * u, marginTop: 6 * u }]}
        numberOfLines={3}
      >
        {p.line}
      </Text>

      <View style={{ flex: 1 }} />
      <Animated.Text style={[styles.continue, { fontSize: 18 * u }, blinkStyle]}>
        CONTINUE ? 9…
      </Animated.Text>
      <Text style={[styles.hud, { fontSize: 11 * u, marginTop: 10 * u }]} numberOfLines={1}>
        {`${p.teamName.toUpperCase()} ${formatKg(p.teamKg)} KG · CANAP' ${p.skips}`}
      </Text>
      <Text
        style={[
          styles.hud,
          { fontSize: 10 * u, marginTop: 6 * u, color: '#8A8B92', letterSpacing: 0 },
        ]}
        numberOfLines={1}
      >
        {`INSERT COIN · ${p.inviteLabel}`}
      </Text>
    </View>
  );
}

function Heart({ size, full }: { size: number; full: boolean }) {
  // 5×4 pixel heart.
  const px = size / 5;
  const rows = ['01010', '11111', '01110', '00100'];
  return (
    <View style={{ width: size, height: px * 4 }}>
      {rows.map((r, y) =>
        r.split('').map((c, x) =>
          c === '1' ? (
            <View
              key={`${x}-${y}`}
              style={{
                position: 'absolute',
                left: x * px,
                top: y * px,
                width: px,
                height: px,
                backgroundColor: full ? ORANGE : '#3A3B42',
              }}
            />
          ) : null,
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: SCREEN, overflow: 'hidden' },
  scan: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.035)' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  hearts: { flexDirection: 'row', alignItems: 'center' },
  hud: { fontFamily: fonts.expanded, color: WHITE, letterSpacing: 1 },
  brand: { fontFamily: fonts.black, color: WHITE },
  big: { fontFamily: fonts.black, color: WHITE, includeFontPadding: false },
  shadow: { position: 'absolute', color: ORANGE },
  canapRow: { flexDirection: 'row', alignItems: 'flex-end' },
  headline: { fontFamily: fonts.expandedHeavy, color: WHITE },
  line: { fontFamily: fonts.medium, color: '#B9BAC2' },
  continue: {
    fontFamily: fonts.expandedHeavy,
    color: ORANGE,
    textAlign: 'center',
    letterSpacing: 2,
  },
});
