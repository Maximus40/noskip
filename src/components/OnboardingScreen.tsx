import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { ONBOARDING_TOTAL } from '@/domain/onboarding';
import { colors, minTouch, spacing } from '@/theme/tokens';

type Props = {
  step: number;
  label?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  canGoBack?: boolean;
};

/** Shared frame of the 10 onboarding steps: segmented progress, giant title, sticky action. */
export function OnboardingScreen({
  step,
  label,
  title,
  subtitle,
  children,
  footer,
  canGoBack = true,
}: Props) {
  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          {canGoBack && router.canGoBack() ? (
            <PressableScale
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Retour"
              style={styles.back}
            >
              <Text variant="headline">←</Text>
            </PressableScale>
          ) : (
            <View style={styles.back} />
          )}
          <View
            style={styles.progress}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Étape ${step} sur ${ONBOARDING_TOTAL}`}
            accessibilityValue={{ min: 1, max: ONBOARDING_TOTAL, now: step }}
          >
            {Array.from({ length: ONBOARDING_TOTAL }, (_, i) => (
              <View key={i} style={[styles.segment, i < step && styles.segmentOn]} />
            ))}
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="label" color={colors.accent}>
            {label ?? `Étape ${step} / ${ONBOARDING_TOTAL}`}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color={colors.muted}>
              {subtitle}
            </Text>
          ) : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  back: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  progress: { flex: 1, flexDirection: 'row', gap: 4, paddingRight: spacing.lg },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.card },
  segmentOn: { backgroundColor: colors.accent },
  content: { padding: spacing.xl, gap: spacing.md },
  body: { marginTop: spacing.lg, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
});
