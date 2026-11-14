import { Redirect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Canap, type CanapMood } from '@/components/Canap';
import { StyledPoster } from '@/components/posters/StyledPoster';
import { TeamBar } from '@/components/TeamBar';
import { Text } from '@/components/ui/Text';
import type { Plate } from '@/domain/bar';
import { POSTER_STYLES, SAMPLE_PSEUDO, SHOP_ITEMS, sampleSkipLine } from '@/domain/shop';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

const SIZE = 512;
const SAMPLE = {
  pseudo: SAMPLE_PSEUDO,
  teamName: 'Ta team',
  teamKg: 200,
  skips: 1,
  inviteLabel: '',
  weekLabel: 'Cette semaine',
  animated: false,
} as const;

const PACK_MOOD: Record<string, CanapMood> = {
  foot: 'laughing',
  gaming: 'evil',
  braquage: 'cool',
  telerealite: 'wink',
  rap: 'cool',
  manga: 'evil',
  daron: 'sleepy',
  horoscope: 'wink',
};

/**
 * Development only: the 1024 × 1024 « promoted in-app purchase » image of a shop product
 * (?id=noskip.shop.…), captured at 2× for App Store Connect.
 */
export default function DevPromo() {
  const id = useLocalSearchParams<{ id?: string }>().id ?? '';
  if (!__DEV__) return <Redirect href="/" />;
  const item = SHOP_ITEMS.find((i) => i.productId === id);
  return (
    <View style={styles.tile}>
      <Svg style={StyleSheet.absoluteFill} width={SIZE} height={SIZE}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="55%" rx="60%" ry="55%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.38} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#g)" />
      </Svg>
      {item?.kind === 'poster' ? (
        <View style={styles.poster}>
          <StyledPoster
            style={item.style}
            width={250}
            line={sampleSkipLine('leg-day')}
            {...SAMPLE}
          />
        </View>
      ) : null}
      {item?.kind === 'posterBundle' ? (
        <View style={styles.fan}>
          {POSTER_STYLES.filter((s) => s !== 'classic').map((s, i, all) => (
            <View
              key={s}
              style={[
                styles.fanItem,
                { left: i * 38, transform: [{ rotate: `${(i - (all.length - 1) / 2) * 5}deg` }] },
              ]}
            >
              <StyledPoster style={s} width={150} line={sampleSkipLine('plaid')} {...SAMPLE} />
            </View>
          ))}
        </View>
      ) : null}
      {item?.kind === 'skin' ? (
        <View style={styles.center}>
          <TeamBar
            plates={[0, 1, 2, 3].map((i): Plate => ({
              key: `p${i}`,
              playerId: 'me',
              color: colors.accent,
              isMe: true,
              skin: item.skin,
            }))}
            width={460}
            accessibilityLabel={item.title}
          />
        </View>
      ) : null}
      {item?.kind === 'pack' ? (
        <View style={styles.center}>
          <Canap mood={PACK_MOOD[item.pack] ?? 'smug'} size={260} accessible={false} />
          <PackWord word={item.title.replace('Pack vannes ', '').toUpperCase()} />
          <Text style={styles.packSub}>10 VANNES DU CANAP&apos;</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The pack name, as big as it fits on one line (Archivo Black is about 0.75 em per letter). */
function PackWord({ word }: { word: string }) {
  const fontSize = Math.min(64, Math.floor(450 / (word.length * 0.75)));
  return (
    <Text style={[styles.packWord, { fontSize, lineHeight: fontSize * 1.2 }]} numberOfLines={1}>
      {word}
    </Text>
  );
}

const styles = StyleSheet.create({
  tile: { width: SIZE, height: SIZE, backgroundColor: colors.bg, overflow: 'hidden' },
  poster: {
    position: 'absolute',
    left: (SIZE - 250) / 2,
    top: (SIZE - (250 * 16) / 9) / 2,
    borderRadius: 10,
    overflow: 'hidden',
    transform: [{ rotate: '-4deg' }],
  },
  fan: { position: 'absolute', left: 50, top: 110, width: 412, height: 300 },
  fanItem: { position: 'absolute', borderRadius: 6, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  packWord: {
    fontFamily: fonts.black,
    color: colors.offWhite,
    letterSpacing: -2,
    maxWidth: 460,
  },
  packSub: { fontFamily: fonts.bold, color: colors.accent, fontSize: 18, letterSpacing: 3 },
});
