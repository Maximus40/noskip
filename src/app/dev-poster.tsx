import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { skipLineText } from '../../content/skip-lines';
import { SkipPoster } from '@/components/SkipPoster';
import { colors, spacing } from '@/theme/tokens';

/** Development-only: the SKIP poster with sample data, for visual QA (no backend). */
export default function DevPoster() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <View style={styles.screen}>
      <SkipPoster
        width={360}
        pseudo="Maxime"
        line={skipLineText('leg-day', 'Maxime')}
        teamName="Les Déchaînés"
        teamKg={200}
        skips={1}
        weekLabel="Semaine du 26 oct. au 1er nov."
        inviteLabel="Rejoins la team sur NoSkip · code ABCD-2345"
        animated={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', padding: spacing.md },
});
