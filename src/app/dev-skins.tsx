import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TeamBar } from '@/components/TeamBar';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import type { Plate } from '@/domain/bar';
import { PLATE_SKINS } from '@/domain/shop';
import { colors, radii, spacing } from '@/theme/tokens';

/** Development only: every plate skin on a team bar (teammates in grey), for visual QA. */
export default function DevSkins() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen>
      {PLATE_SKINS.map((skin) => {
        const plates: Plate[] = [
          { key: 'k', playerId: 'k', color: colors.plates[1], isMe: false },
          { key: 's', playerId: 's', color: colors.plates[2], isMe: false },
          ...[0, 1].map((i) => ({
            key: `me-${i}`,
            playerId: 'me',
            color: colors.accent,
            isMe: true,
            ...(skin === 'classic' ? {} : { skin }),
          })),
        ];
        return (
          <View key={skin} style={styles.card}>
            <Text variant="label" color={colors.accent}>
              {skin}
            </Text>
            <TeamBar plates={plates} width={320} accessibilityLabel={skin} />
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
