import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { type BarPlayer, statusLabel } from '@/domain/bar';
import { initialsOf } from '@/domain/profile';
import type { WeekRisk } from '@/domain/week';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

type Props = {
  player: BarPlayer & { risk: WeekRisk };
  avatarUrl: string | null;
  spot: { state: 'available' | 'sent' | 'hidden'; onPress: () => void; busy: boolean };
};

/** One teammate: plate colour, avatar, 2/3, today's coarse status. Never a place or a time. */
export function PlayerRow({ player, avatarUrl, spot }: Props) {
  const tint = player.isMe ? colors.accent : player.color;
  const status = player.joker ? 'Joker blessure' : statusLabel(player.status);
  // At risk, the warning replaces the status so the line never wraps next to the Spot button.
  const line =
    player.risk === 'shaky'
      ? 'Risque le skip'
      : player.risk === 'lost'
        ? 'Objectif hors de portée'
        : status;
  const alert = player.risk === 'shaky' || player.risk === 'lost';
  return (
    <View
      style={styles.row}
      accessible={spot.state !== 'available'}
      accessibilityLabel={`${player.pseudo}${player.isMe ? ' (toi)' : ''}, ${player.done} sur ${player.goal}, ${status}${alert ? `, ${line.toLowerCase()}` : ''}`}
    >
      <View style={[styles.plate, { backgroundColor: tint }]} />
      <View style={[styles.avatar, { borderColor: tint }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <Text variant="bodyStrong" color={player.isMe ? colors.accent : colors.offWhite}>
            {initialsOf(player.pseudo)}
          </Text>
        )}
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {player.isMe ? `${player.pseudo} (toi)` : player.pseudo}
        </Text>
        <Text variant="caption" color={alert ? colors.accent : colors.muted} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <Text variant="headline" style={styles.count}>
        {`${player.done}/${player.goal}`}
      </Text>
      {spot.state === 'available' ? (
        <PressableScale
          onPress={spot.onPress}
          disabled={spot.busy}
          accessibilityRole="button"
          accessibilityLabel={`Spotter ${player.pseudo}`}
          accessibilityHint="Lui envoie une notification pour le motiver"
          style={styles.spot}
        >
          <Text variant="label" color={colors.accent}>
            Spot
          </Text>
        </PressableScale>
      ) : spot.state === 'sent' ? (
        <View style={[styles.spot, styles.spotSent]}>
          <Text variant="label" color={colors.muted}>
            Spotté
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  plate: { width: 6, height: 34, borderRadius: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  avatarImg: { width: 40, height: 40 },
  text: { flex: 1, gap: 2 },
  count: { minWidth: 36, textAlign: 'right' },
  spot: {
    minHeight: minTouch,
    minWidth: 64,
    paddingHorizontal: spacing.md,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotSent: { borderColor: colors.glassBorder },
});
