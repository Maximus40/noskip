import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import type { LegalSection } from '../../content/legal';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme/tokens';

type Props = { label: string; title: string; sections: LegalSection[]; url: string | null };

/** Long-form legal text: one heading per section, readable line length, public URL at the end. */
export function LegalScreen({ label, title, sections, url }: Props) {
  return (
    <Screen
      footer={
        <Button
          label="Retour"
          variant="ghost"
          withArrow={false}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      <View style={styles.head}>
        <Text variant="label" color={colors.accent}>
          {label}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {sections.map((s) => (
        <View key={s.title} style={styles.section}>
          <Text variant="headline" accessibilityRole="header">
            {s.title}
          </Text>
          {s.body.map((p) => (
            <Text key={p.slice(0, 32)} variant="body" color="#D2D3D6">
              {p}
            </Text>
          ))}
        </View>
      ))}
      {url ? (
        <Button
          label="Version en ligne"
          variant="secondary"
          withArrow={false}
          onPress={() => Linking.openURL(url)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm },
  section: { gap: spacing.sm, maxWidth: 640 },
});
