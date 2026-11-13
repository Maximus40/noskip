import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/Wordmark';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL,
  remainingLabel,
  remainingSteps,
} from '@/domain/onboarding';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSignedInOnboardingState } from '@/features/onboarding/useOnboardingState';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

type Props = {
  step: number;
  label?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  canGoBack?: boolean;
  /** Reused from the settings (edit mode): no progress bar, this label instead of the step. */
  editLabel?: string;
  /** Shows the NOXCUSE. logo above the step label (first screens). */
  brand?: boolean;
  /** « Pourquoi ? » card under the subtitle: what this step changes in the game. */
  why?: string;
};

/**
 * Shared frame of the onboarding steps: segmented progress, giant title, sticky action. The
 * counter is honest: once signed in, steps already done (a returning player, a teammate who
 * pays) are not counted, so it never seems to jump.
 */
export function OnboardingScreen(props: Props) {
  const signedIn = useAuth().session !== null;
  const route = ONBOARDING_STEPS[props.step - 1]?.route;
  if (signedIn && route && !props.editLabel) return <SignedInFrame {...props} />;
  return <Frame {...props} left={route ? remainingSteps(route, null) : 1} />;
}

function SignedInFrame(props: Props) {
  const { state } = useSignedInOnboardingState();
  const route = ONBOARDING_STEPS[props.step - 1]!.route;
  return <Frame {...props} left={remainingSteps(route, state)} />;
}

function Frame({
  step,
  label,
  title,
  subtitle,
  children,
  footer,
  canGoBack = true,
  editLabel,
  brand = false,
  why,
  left,
}: Props & { left: number }) {
  // Filled segments: everything behind the player, including steps skipped as already done.
  const filled = ONBOARDING_TOTAL - left + 1;
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
          {editLabel ? (
            <View style={styles.progress} />
          ) : (
            <View
              style={styles.progress}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={remainingLabel(left)}
              accessibilityValue={{ min: 1, max: ONBOARDING_TOTAL, now: filled }}
            >
              {Array.from({ length: ONBOARDING_TOTAL }, (_, i) => (
                <View key={i} style={[styles.segment, i < filled && styles.segmentOn]} />
              ))}
            </View>
          )}
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {brand ? <Wordmark size={28} style={styles.brand} /> : null}
          <Text variant="label" color={colors.accent}>
            {editLabel ?? label ?? remainingLabel(left)}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color={colors.muted}>
              {subtitle}
            </Text>
          ) : null}
          {why ? (
            <View style={styles.why} accessible accessibilityLabel={`Pourquoi ? ${why}`}>
              <Text variant="label" color={colors.accent}>
                Pourquoi ?
              </Text>
              <Text variant="caption" color="#C9CACE">
                {why}
              </Text>
            </View>
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
  brand: { marginBottom: spacing.sm },
  why: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
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
