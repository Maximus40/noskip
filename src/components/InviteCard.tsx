import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatInviteCode } from '@/domain/teams';
import { shareInvite } from '@/features/teams/shareInvite';
import { colors, radii, spacing } from '@/theme/tokens';

type Props = { teamName: string; code: string; memberCount: number };

/** Big readable code + native share. The invite is the growth loop: make it obvious. */
export function InviteCard({ teamName, code, memberCount }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={styles.card}>
      <Text variant="label" color={colors.accent}>
        {memberCount <= 1 ? 'Ta team est vide. Le Canap’ adore.' : 'Invite encore un pote'}
      </Text>
      <PressableScale
        onPress={async () => {
          await Clipboard.setStringAsync(code);
          setCopied(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Code d'invitation ${code.split('').join(' ')}. Touche pour copier.`}
      >
        <Text variant="display" style={styles.code}>
          {formatInviteCode(code)}
        </Text>
      </PressableScale>
      <Text variant="caption" color={colors.muted} accessibilityLiveRegion="polite">
        {copied ? 'Code copié.' : 'Touche le code pour le copier.'}
      </Text>
      <Button label="Envoyer l'invitation" onPress={() => shareInvite(teamName, code)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.cardLarge,
    padding: spacing.xl,
    gap: spacing.md,
  },
  code: { letterSpacing: 2 },
});
