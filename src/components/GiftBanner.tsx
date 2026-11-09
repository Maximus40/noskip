import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassPanel } from '@/components/ui/GlassPanel';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useEntitlement } from '@/features/subscriptions/api';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

const SEEN_KEY = 'noskip.gift-seen.v1';

/** "Offert par {pseudo}": shown once when a teammate's Pack Duo or Team plan covers me. */
export function GiftBanner() {
  const entitlement = useEntitlement();
  const gift = entitlement.data?.active && entitlement.data.offeredBy ? entitlement.data : null;
  const id = gift ? `${gift.source}:${gift.offeredBy}` : null;
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then(setSeen)
      .catch(() => setSeen(null));
  }, []);

  if (!gift || !id || seen === undefined || seen === id) return null;

  const dismiss = () => {
    setSeen(id);
    AsyncStorage.setItem(SEEN_KEY, id).catch(() => undefined);
  };

  return (
    <GlassPanel radius={radii.glass} style={styles.panel}>
      <View style={styles.flex} accessible accessibilityLiveRegion="polite">
        <Text variant="label" color={colors.accent}>
          {`Offert par ${gift.offeredBy}`}
        </Text>
        <Text variant="body">
          {gift.source === 'team'
            ? `L’offre Team de « ${gift.teamName ?? 'ta team'} » te couvre. Bienvenue dans le game.`
            : `${gift.offeredBy} t’offre son Pack Duo. Plus d’excuse maintenant.`}
        </Text>
      </View>
      <PressableScale
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        style={styles.close}
      >
        <Text variant="bodyStrong">OK</Text>
      </PressableScale>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  flex: { flex: 1, gap: 2 },
  close: {
    minWidth: minTouch,
    minHeight: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
