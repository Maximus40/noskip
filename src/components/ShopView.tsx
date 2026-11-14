import { useEffect, useRef } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { StyledPoster } from '@/components/posters/StyledPoster';
import { TeamBar } from '@/components/TeamBar';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import type { Plate } from '@/domain/bar';
import {
  ownsPosterStyle,
  packSamples,
  SAMPLE_PSEUDO,
  sampleSkipLine,
  type PlateSkin,
  type PosterStyle,
  SHOP_ITEMS,
  type ShopItem,
} from '@/domain/shop';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

export type ShopViewProps = {
  owned: ReadonlySet<string>;
  equipped: PlateSkin;
  /** The SKIP poster style I impose on my teammates' cards. */
  poster: PosterStyle;
  /** Store prices by product id (empty while loading or without payments). */
  prices: Readonly<Record<string, string>>;
  paymentsReady: boolean;
  buyBusy: boolean;
  equipBusy: boolean;
  message: string | null;
  error: string | null;
  onBuy: (item: ShopItem) => void;
  onEquip: (skin: PlateSkin) => void;
  onEquipPoster: (style: PosterStyle) => void;
  onRestore: () => void;
  /** Shown as « Fermer » when the shop is opened over another screen (not as a tab). */
  onClose?: () => void;
};

/**
 * La boutique (display only): one-time cosmetic purchases, plate skins seen by the whole team
 * and packs of SKIP lines for the team's Sunday cards. Never anything that changes the game.
 */
export function ShopView({
  owned,
  equipped,
  poster,
  prices,
  paymentsReady,
  buyBusy,
  equipBusy,
  message,
  error,
  onBuy,
  onEquip,
  onEquipPoster,
  onRestore,
  onClose,
}: ShopViewProps) {
  const reduced = useReducedMotion();
  const enter = (i: number) => (reduced ? FadeIn : FadeInDown.delay(i * 70).duration(380));
  const skins = SHOP_ITEMS.filter((i) => i.kind === 'skin');
  const packs = SHOP_ITEMS.filter((i) => i.kind === 'pack');

  return (
    <Screen>
      <View style={styles.head}>
        <Text variant="label" color={colors.accent} style={styles.flex}>
          La boutique
        </Text>
        {onClose ? (
          <PressableScale onPress={onClose} accessibilityRole="link" style={styles.close}>
            <Text variant="caption" style={styles.underline}>
              Fermer
            </Text>
          </PressableScale>
        ) : null}
      </View>
      <Text variant="display" style={styles.title} accessibilityRole="header">
        DU STYLE. ZÉRO TRICHE.
      </Text>
      <Text variant="body" color={colors.muted}>
        Ici, rien ne s’achète pour gagner : ni séance, ni disque, ni joker. Juste de quoi chambrer
        avec classe.
      </Text>

      <ErrorNote message={error} />
      {message ? (
        <Text variant="bodyStrong" color={colors.accent} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      {!paymentsReady ? (
        <Text variant="caption" color={colors.muted}>
          Les achats ne sont pas branchés dans cette version.
        </Text>
      ) : null}

      <PosterSection
        owned={owned}
        poster={poster}
        prices={prices}
        paymentsReady={paymentsReady}
        buyBusy={buyBusy}
        equipBusy={equipBusy}
        onBuy={onBuy}
        onEquipPoster={onEquipPoster}
      />

      <Text variant="headline" style={styles.section}>
        Skins de disques
      </Text>
      <Text variant="caption" color={colors.muted}>
        Tes disques changent de look sur la barre de toutes tes teams. Tes potes les voient.
      </Text>

      {equipped !== 'classic' ? (
        <Animated.View entering={enter(0)} style={styles.card}>
          <SkinPreview skin="classic" />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">Disques Classiques</Text>
              <Text variant="caption" color={colors.muted}>
                Le orange d’origine. Toujours gratuit.
              </Text>
            </View>
            <Button
              label="Équiper"
              variant="secondary"
              withArrow={false}
              disabled={equipBusy}
              onPress={() => onEquip('classic')}
            />
          </View>
        </Animated.View>
      ) : null}

      {skins.map((item, i) => {
        if (item.kind !== 'skin') return null;
        const has = owned.has(item.productId);
        const worn = equipped === item.skin;
        return (
          <Animated.View key={item.productId} entering={enter(i + 1)} style={styles.card}>
            <SkinPreview skin={item.skin} />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{item.title}</Text>
                <Text variant="caption" color={colors.muted}>
                  {item.pitch}
                </Text>
              </View>
              {worn ? (
                <Badge label="Équipé" />
              ) : has ? (
                <Button
                  label="Équiper"
                  variant="secondary"
                  withArrow={false}
                  disabled={equipBusy}
                  onPress={() => onEquip(item.skin)}
                />
              ) : (
                <BuyButton
                  item={item}
                  price={prices[item.productId]}
                  busy={buyBusy}
                  ready={paymentsReady}
                  onBuy={onBuy}
                />
              )}
            </View>
          </Animated.View>
        );
      })}

      <Text variant="headline" style={styles.section}>
        Packs de vannes du Canap’
      </Text>
      <Text variant="caption" color={colors.muted}>
        Un pack acheté par un joueur profite à toute sa team : ses vannes s’ajoutent au tirage des
        cartes SKIP du dimanche.
      </Text>

      {packs.map((item, i) => {
        if (item.kind !== 'pack') return null;
        const has = owned.has(item.productId);
        return (
          <Animated.View key={item.productId} entering={enter(i + 5)} style={styles.card}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{item.title}</Text>
              <Text variant="caption" color={colors.muted}>
                {item.pitch}
              </Text>
            </View>
            {packSamples(item.pack).map((line) => (
              <Text key={line} variant="body" style={styles.quote}>
                {`« ${line} »`}
              </Text>
            ))}
            <View style={styles.rowEnd}>
              {has ? (
                <Badge label="Débloqué pour ta team" />
              ) : (
                <BuyButton
                  item={item}
                  price={prices[item.productId]}
                  busy={buyBusy}
                  ready={paymentsReady}
                  onBuy={onBuy}
                />
              )}
            </View>
          </Animated.View>
        );
      })}

      {paymentsReady ? (
        <PressableScale onPress={onRestore} accessibilityRole="link" style={styles.restore}>
          <Text variant="caption" style={styles.underline}>
            Restaurer mes achats
          </Text>
        </PressableScale>
      ) : null}
      <View style={styles.bottom} />
    </Screen>
  );
}

/** A different real line on each preview, so the shop shows the variety of the cards. */
const SAMPLE_LINE: Record<PosterStyle, string> = {
  classic: 'leg-day',
  gold: 'canap-pr-sieste',
  redcard: 'plaid',
  gameover: 'telecommande',
  wanted: 'place-chauffee',
  news: 'reveil',
  warrior: 'leg-day',
  magazine: 'serie-netflix',
  neon: 'chips-orange',
  zen: 'demain-promis',
};
const sampleLine = (style: PosterStyle) => sampleSkipLine(SAMPLE_LINE[style]);

const SAMPLE = {
  pseudo: SAMPLE_PSEUDO,
  teamName: 'Ta team',
  teamKg: 200,
  skips: 1,
  inviteLabel: 'Rejoins la team',
  weekLabel: 'Cette semaine',
  animated: false,
} as const;

const MINI = 156;
const FAN_STEP = 26;

/** Premium SKIP cards: equip one, and your teammates' SKIP cards come out in your style. */
function PosterSection({
  owned,
  poster,
  prices,
  paymentsReady,
  buyBusy,
  equipBusy,
  onBuy,
  onEquipPoster,
}: Pick<
  ShopViewProps,
  | 'owned'
  | 'poster'
  | 'prices'
  | 'paymentsReady'
  | 'buyBusy'
  | 'equipBusy'
  | 'onBuy'
  | 'onEquipPoster'
>) {
  const styles_ = SHOP_ITEMS.filter((i) => i.kind === 'poster');
  const bundle = SHOP_ITEMS.find((i) => i.kind === 'posterBundle');
  const allOwned = styles_.every((i) => i.kind === 'poster' && ownsPosterStyle(owned, i.style));
  const reduced = useReducedMotion();
  const rail = useRef<ScrollViewInstance>(null);
  // Show that the rail scrolls: a small nudge right then back, once, and a sliding arrow.
  useEffect(() => {
    if (reduced) return;
    const go = setTimeout(() => rail.current?.scrollTo({ x: 90, animated: true }), 700);
    const back = setTimeout(() => rail.current?.scrollTo({ x: 0, animated: true }), 1300);
    return () => {
      clearTimeout(go);
      clearTimeout(back);
    };
  }, [reduced]);
  const slide = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    slide.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [reduced, slide]);
  const arrow = useAnimatedStyle(() => ({ transform: [{ translateX: slide.value }] }));
  return (
    <>
      <Text variant="headline" style={styles.section}>
        Cartes SKIP premium
      </Text>
      <Text variant="caption" color={colors.muted}>
        Équipe une carte : quand un pote de ta team skip, sa carte SKIP sort dans ton style. Toute
        la team la voit, et elle part en story.
      </Text>
      <View
        style={styles.swipeHint}
        accessible
        accessibilityLabel={`Fais glisser pour voir les ${styles_.length} cartes`}
      >
        <Text variant="label" color={colors.accent}>
          {`Fais glisser · ${styles_.length} cartes`}
        </Text>
        <Animated.View style={arrow}>
          <Text variant="bodyStrong" color={colors.accent}>
            →
          </Text>
        </Animated.View>
      </View>
      <ScrollView
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.posterRail}
        style={styles.rail}
      >
        {styles_.map((item) => {
          if (item.kind !== 'poster') return null;
          const has = ownsPosterStyle(owned, item.style);
          const worn = poster === item.style;
          return (
            <View key={item.productId} style={styles.posterCard}>
              <View style={[styles.posterFrame, worn && styles.posterWorn]}>
                <StyledPoster
                  style={item.style}
                  width={MINI}
                  {...SAMPLE}
                  line={sampleLine(item.style)}
                />
              </View>
              <Text variant="bodyStrong">{item.title}</Text>
              <Text variant="caption" color={colors.muted} style={styles.posterPitch}>
                {item.pitch}
              </Text>
              {worn ? (
                <Badge label="Équipée" />
              ) : has ? (
                <Button
                  label="Équiper"
                  variant="secondary"
                  withArrow={false}
                  disabled={equipBusy}
                  onPress={() => onEquipPoster(item.style)}
                />
              ) : (
                <BuyButton
                  item={item}
                  price={prices[item.productId]}
                  busy={buyBusy}
                  ready={paymentsReady}
                  onBuy={onBuy}
                />
              )}
            </View>
          );
        })}
      </ScrollView>

      {bundle && !allOwned ? (
        <View style={[styles.card, styles.bundle]}>
          <View style={styles.fan} accessible={false}>
            {styles_.map((item, i) =>
              item.kind === 'poster' ? (
                <View
                  key={item.productId}
                  style={[
                    styles.fanItem,
                    {
                      left: i * FAN_STEP,
                      transform: [{ rotate: `${(i - (styles_.length - 1) / 2) * 4}deg` }],
                      zIndex: i,
                    },
                  ]}
                >
                  <StyledPoster
                    style={item.style}
                    width={72}
                    {...SAMPLE}
                    line={sampleLine(item.style)}
                  />
                </View>
              ) : null,
            )}
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text variant="label" color={colors.accent}>
                Meilleure affaire
              </Text>
              <Text variant="bodyStrong">{bundle.title}</Text>
              <Text variant="caption" color={colors.muted}>
                {bundle.pitch}
              </Text>
            </View>
            <BuyButton
              item={bundle}
              price={prices[bundle.productId]}
              busy={buyBusy}
              ready={paymentsReady}
              onBuy={onBuy}
            />
          </View>
        </View>
      ) : null}

      {poster !== 'classic' ? (
        <PressableScale
          onPress={() => onEquipPoster('classic')}
          accessibilityRole="button"
          disabled={equipBusy}
          style={styles.restore}
        >
          <Text variant="caption" style={styles.underline}>
            Remettre la carte classique
          </Text>
        </PressableScale>
      ) : null}
    </>
  );
}

function BuyButton({
  item,
  price,
  busy,
  ready,
  onBuy,
}: {
  item: ShopItem;
  price: string | undefined;
  busy: boolean;
  ready: boolean;
  onBuy: (item: ShopItem) => void;
}) {
  return (
    <Button
      label={price ? price : '…'}
      withArrow={false}
      disabled={busy || !price || !ready}
      onPress={() => onBuy(item)}
    />
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text variant="label" color={colors.ink}>
        {label}
      </Text>
    </View>
  );
}

/** Three of your plates on a bar, in the skin. */
function SkinPreview({ skin }: { skin: PlateSkin }) {
  const plates: Plate[] = [0, 1, 2].map((i) => ({
    key: `${skin}-${i}`,
    playerId: 'me',
    color: colors.accent,
    isMe: true,
    ...(skin === 'classic' ? {} : { skin }),
  }));
  return (
    <View style={styles.preview}>
      <TeamBar plates={plates} width={260} accessibilityLabel={`Aperçu des disques ${skin}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  close: { minHeight: minTouch, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  title: { fontSize: 36, lineHeight: 38, letterSpacing: -1 },
  section: { marginTop: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  preview: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
  quote: { fontStyle: 'italic', color: '#C9CACE' },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  restore: { minHeight: minTouch, justifyContent: 'center', alignItems: 'center' },
  bottom: { height: spacing.xl },
  rail: { marginHorizontal: -spacing.lg },
  posterRail: { paddingHorizontal: spacing.lg, gap: spacing.md },
  swipeHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  posterCard: {
    width: MINI + spacing.md * 2,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  posterFrame: { borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  posterWorn: { borderColor: colors.accent },
  posterPitch: { minHeight: 48 },
  bundle: { borderWidth: 1, borderColor: colors.accent },
  fan: { height: 140, width: 72 + FAN_STEP * 8, alignSelf: 'center' },
  fanItem: { position: 'absolute', top: 6, borderRadius: 4, overflow: 'hidden' },
});
