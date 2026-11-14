import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BagIcon, BarIcon, CardIcon, SettingsIcon, TeamsIcon } from '@/components/icons/TabIcons';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { SHOP_CATALOG_VERSION } from '@/domain/shop';
import { useLocalOnboarding } from '@/features/onboarding/localStore';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

const ICONS = {
  team: BarIcon,
  teams: TeamsIcon,
  boutique: BagIcon,
  lifter: CardIcon,
  settings: SettingsIcon,
} as const;

const LABELS: Record<keyof typeof ICONS, string> = {
  team: 'Ma team',
  teams: 'Teams',
  boutique: 'Boutique',
  lifter: 'Ma carte',
  settings: 'Réglages',
};

function isTab(name: string): name is keyof typeof ICONS {
  return name in ICONS;
}

/** Floating glass tab bar. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Orange dot on the shop until the player has seen the latest items.
  const local = useLocalOnboarding();
  const shopNews = (local.data?.shopSeenVersion ?? SHOP_CATALOG_VERSION) < SHOP_CATALOG_VERSION;
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <GlassPanel radius={radii.glassLarge} style={styles.panel}>
        <View style={styles.row} accessibilityRole="tablist">
          {state.routes.map((route, index) => {
            if (!isTab(route.name)) return null;
            const focused = state.index === index;
            const Icon = ICONS[route.name];
            const tint = focused ? colors.accent : colors.muted;
            return (
              <PressableScale
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={
                  route.name === 'boutique' && shopNews
                    ? `${LABELS[route.name]}, nouveautés`
                    : LABELS[route.name]
                }
                onPress={() => {
                  if (!focused) navigateToTab(route.key);
                }}
                style={styles.tab}
              >
                <View>
                  <Icon color={tint} />
                  {route.name === 'boutique' && shopNews ? <View style={styles.dot} /> : null}
                </View>
                <Text variant="caption" color={tint} style={styles.label}>
                  {LABELS[route.name]}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 0 },
  panel: { paddingVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  tab: { minWidth: minTouch, minHeight: minTouch, alignItems: 'center', gap: 2 },
  label: { fontSize: 11 },
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
});
