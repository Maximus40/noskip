import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { TeamBar } from '@/components/TeamBar';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import type { Plate } from '@/domain/bar';
import { packSamples, type PlateSkin, SHOP_ITEMS, type ShopItem } from '@/domain/shop';
import { useBuyShopItem, useEquipSkin, useMyShop, useShopPrices } from '@/features/shop/api';
import { paymentsAvailable, useRestore } from '@/features/subscriptions/api';
import { toUserMessage } from '@/lib/errors';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

/**
 * La boutique: one-time cosmetic purchases (plate skins seen by the whole team, packs of SKIP
 * lines for the team's Sunday cards). Never anything that changes the game.
 */
export default function ShopScreen() {
  const reduced = useReducedMotion();
  const shop = useMyShop();
  const prices = useShopPrices();
  const buy = useBuyShopItem();
  const equip = useEquipSkin();
  const restore = useRestore();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const owned = shop.data?.owned ?? new Set<string>();
  const equipped = shop.data?.equipped ?? 'classic';
  const enter = (i: number) => (reduced ? FadeIn : FadeInDown.delay(i * 70).duration(380));

  async function onBuy(item: ShopItem) {
    setError(null);
    setMessage(null);
    try {
      const result = await buy.mutateAsync(item.productId);
      if (result === 'bought') {
        setMessage(
          item.kind === 'skin'
            ? `${item.title} : achat validé. Il arrive dans quelques secondes, puis touche « Équiper ».`
            : `${item.title} : achat validé. Ses vannes rejoignent les cartes SKIP de ta team.`,
        );
      }
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function onEquip(skin: PlateSkin) {
    setError(null);
    try {
      await equip.mutateAsync(skin);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function onRestore() {
    setError(null);
    try {
      await restore.mutateAsync();
      await shop.refetch();
      setMessage('Achats restaurés.');
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  const skins = SHOP_ITEMS.filter((i) => i.kind === 'skin');
  const packs = SHOP_ITEMS.filter((i) => i.kind === 'pack');

  return (
    <Screen>
      <View style={styles.head}>
        <Text variant="label" color={colors.accent} style={styles.flex}>
          La boutique
        </Text>
        <PressableScale
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/lifter'))}
          accessibilityRole="link"
          style={styles.close}
        >
          <Text variant="caption" style={styles.underline}>
            Fermer
          </Text>
        </PressableScale>
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
      {!paymentsAvailable() ? (
        <Text variant="caption" color={colors.muted}>
          Les achats ne sont pas branchés dans cette version.
        </Text>
      ) : null}

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
              disabled={equip.isPending}
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
                  disabled={equip.isPending}
                  onPress={() => onEquip(item.skin)}
                />
              ) : (
                <BuyButton
                  item={item}
                  price={prices.data?.[item.productId]}
                  busy={buy.isPending}
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
                  price={prices.data?.[item.productId]}
                  busy={buy.isPending}
                  onBuy={onBuy}
                />
              )}
            </View>
          </Animated.View>
        );
      })}

      {paymentsAvailable() ? (
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

function BuyButton({
  item,
  price,
  busy,
  onBuy,
}: {
  item: ShopItem;
  price: string | undefined;
  busy: boolean;
  onBuy: (item: ShopItem) => void;
}) {
  return (
    <Button
      label={price ? price : '…'}
      withArrow={false}
      disabled={busy || !price || !paymentsAvailable()}
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
});
