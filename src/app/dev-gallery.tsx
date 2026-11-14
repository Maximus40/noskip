import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Canap } from '@/components/Canap';
import { MapBackdrop } from '@/components/MapBackdrop';
import { PlayerRow } from '@/components/PlayerRow';
import { TeamBar } from '@/components/TeamBar';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Text } from '@/components/ui/Text';
import { platesFor } from '@/domain/bar';
import { colors, radii, spacing } from '@/theme/tokens';

/** Development-only visual QA board: components with fixed sample data, no backend. */
export default function DevGallery() {
  if (!__DEV__) return <Redirect href="/" />;
  const players = [
    {
      id: 'me',
      pseudo: 'Sam',
      color: '#F5F5F0',
      isMe: true,
      goal: 3,
      done: 3,
      status: 'done' as const,
      joker: false,
    },
    {
      id: 'k',
      pseudo: 'Alex',
      color: '#7C7E84',
      isMe: false,
      goal: 4,
      done: 1,
      status: 'not_yet' as const,
      joker: false,
    },
    {
      id: 'm',
      pseudo: 'Lou',
      color: '#B9BBC0',
      isMe: false,
      goal: 3,
      done: 2,
      status: 'at_gym' as const,
      joker: false,
    },
  ];
  const plates = platesFor(players, colors.accent);
  return (
    <View style={styles.fill}>
      <MapBackdrop center={null} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="label" color={colors.muted}>
          Barre de la team · cette semaine
        </Text>
        <Text variant="display" style={styles.kg}>
          120 kg
        </Text>
        <GlassPanel style={styles.panel}>
          <TeamBar
            plates={plates}
            newPlateKey="me-2"
            shaky
            width={320}
            accessibilityLabel="Barre"
          />
          <Text variant="bodyStrong" color={colors.accent}>
            Alex risque le skip. La barre tremble.
          </Text>
        </GlassPanel>
        <GlassPanel style={styles.panel}>
          <PlayerRow
            player={{ ...players[0], risk: 'achieved' }}
            avatarUrl={null}
            spot={{ state: 'hidden', busy: false, onPress: () => undefined }}
          />
          <PlayerRow
            player={{ ...players[1], risk: 'shaky' }}
            avatarUrl={null}
            spot={{ state: 'available', busy: false, onPress: () => undefined }}
          />
          <PlayerRow
            player={{ ...players[2], risk: 'safe' }}
            avatarUrl={null}
            spot={{ state: 'sent', busy: false, onPress: () => undefined }}
          />
        </GlassPanel>
        <View style={styles.canaps}>
          {(['idle', 'smug', 'sad', 'crushed'] as const).map((mood) => (
            <View key={mood} style={styles.canapCard}>
              <Canap mood={mood} size={150} />
              <Text variant="caption" color={colors.ink}>
                {mood}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.map },
  content: { padding: spacing.lg, gap: spacing.md, paddingTop: 60 },
  kg: { fontSize: 72, lineHeight: 74 },
  panel: { padding: spacing.lg, gap: spacing.md, alignItems: 'stretch' },
  canaps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  canapCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.card,
    padding: spacing.sm,
    alignItems: 'center',
  },
});
