import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { StyledPoster } from '@/components/posters/StyledPoster';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import type { Promo } from '@/domain/promo';
import { SAMPLE_PSEUDO } from '@/domain/shop';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

const SAMPLE = {
  pseudo: SAMPLE_PSEUDO,
  line: '',
  teamName: 'Ta team',
  teamKg: 200,
  skips: 1,
  inviteLabel: '',
  weekLabel: '',
  animated: false,
} as const;

/** One offer on Ma team: tap to open the shop, × to hide it for a few days. */
export function PromoCard({
  promo,
  onOpen,
  onClose,
}: {
  promo: Promo;
  onOpen: () => void;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(380)}>
      <PressableScale
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${promo.eyebrow}. ${promo.title} ${promo.body}`}
        accessibilityHint="Ouvre la boutique"
      >
        <GlassPanel radius={radii.glass} style={styles.card}>
          {promo.poster ? (
            <View style={styles.thumb} accessible={false}>
              <StyledPoster style={promo.poster} width={58} {...SAMPLE} />
            </View>
          ) : null}
          <View style={styles.text}>
            <Text variant="label" color={colors.accent}>
              {promo.eyebrow}
            </Text>
            <Text variant="bodyStrong">{promo.title}</Text>
            <Text variant="caption" color={colors.muted}>
              {promo.body}
            </Text>
            <Text variant="caption" color={colors.accent} style={styles.cta}>
              Voir la boutique →
            </Text>
          </View>
          <PressableScale
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Masquer l’offre"
            style={styles.close}
            hitSlop={8}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6l12 12M18 6L6 18"
                stroke={colors.muted}
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            </Svg>
          </PressableScale>
        </GlassPanel>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  thumb: { borderRadius: 6, overflow: 'hidden' },
  text: { flex: 1, gap: 2 },
  cta: { marginTop: spacing.xs },
  close: {
    width: minTouch,
    height: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginRight: -spacing.sm,
    marginTop: -spacing.sm,
  },
});
