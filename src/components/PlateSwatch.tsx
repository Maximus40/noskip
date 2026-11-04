import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

/** Small upright plate in the player's colour; "you" are always orange. */
export function PlateSwatch({ color, isMe }: { color: string; isMe?: boolean }) {
  return <View style={[styles.plate, { backgroundColor: isMe ? colors.accent : color }]} />;
}

const styles = StyleSheet.create({
  plate: { width: 10, height: 34, borderRadius: 3 },
});
