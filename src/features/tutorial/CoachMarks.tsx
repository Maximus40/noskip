import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { bubblePlacement, type CoachStep, type CoachTargetId, type Rect } from '@/domain/tutorial';
import { colors, minTouch, radii, spacing } from '@/theme/tokens';

type Measurable = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

const TargetsContext = createContext<Map<CoachTargetId, Measurable> | null>(null);

/** Holds the elements the coach marks can point at (see useCoachTarget). */
export function CoachMarksProvider({ children }: { children: ReactNode }) {
  const [targets] = useState(() => new Map<CoachTargetId, Measurable>());
  return <TargetsContext.Provider value={targets}>{children}</TargetsContext.Provider>;
}

/** Ref for a View the tutorial can highlight: `<View ref={useCoachTarget('bar')} collapsable={false}>`. */
export function useCoachTarget(id: CoachTargetId) {
  const targets = useContext(TargetsContext);
  return useCallback(
    (node: Measurable | null) => {
      if (!targets) return;
      if (node) targets.set(id, node);
      else targets.delete(id);
    },
    [id, targets],
  );
}

// First guess of the bubble height; replaced by its measured height after the first layout.
const BUBBLE_GUESS = 280;
const PAD = 8;
const DIM = 'rgba(8,8,10,0.8)';

/** Full-screen rectangle with a rounded hole (even-odd fill): the lit element. */
function holePath(w: number, h: number, r: Rect, radius: number): string {
  const k = Math.min(radius, r.width / 2, r.height / 2);
  const { x, y, width: rw, height: rh } = r;
  return (
    `M0 0H${w}V${h}H0Z ` +
    `M${x + k} ${y}H${x + rw - k}A${k} ${k} 0 0 1 ${x + rw} ${y + k}` +
    `V${y + rh - k}A${k} ${k} 0 0 1 ${x + rw - k} ${y + rh}` +
    `H${x + k}A${k} ${k} 0 0 1 ${x} ${y + rh - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`
  );
}

/**
 * Interactive tutorial: the screen dims, the current element stays lit inside an orange frame,
 * and a bubble with an arrow explains it. "Passer" is always there.
 */
export function CoachMarks({
  steps,
  visible,
  onDone,
}: {
  steps: readonly CoachStep[];
  visible: boolean;
  onDone: () => void;
}) {
  const targets = useContext(TargetsContext);
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // Measured frame of the current step's element (none yet, or not measurable).
  const [measured, setMeasured] = useState<{ target: CoachTargetId; rect: Rect | null } | null>(
    null,
  );
  const step = steps[index];
  const [bubbleHeight, setBubbleHeight] = useState(BUBBLE_GUESS);

  useEffect(() => {
    if (!visible || !step) return;
    const node = targets?.get(step.target);
    if (!node) return;
    // Wait a little: the screen may still be laying out (cascade animations).
    const t = setTimeout(
      () =>
        node.measureInWindow((x, y, w, h) =>
          setMeasured({
            target: step.target,
            rect:
              w > 0 && h > 0
                ? { x: x - PAD, y: y - PAD, width: w + 2 * PAD, height: h + 2 * PAD }
                : null,
          }),
        ),
      120,
    );
    return () => clearTimeout(t);
  }, [visible, step, targets]);

  if (!visible || !step) return null;
  const rect = measured?.target === step.target ? measured.rect : null;
  const last = index === steps.length - 1;
  const place = bubblePlacement(rect, height, bubbleHeight);
  const radius = rect ? Math.min(radii.glass, rect.height / 2) : 0;
  const arrowLeft = rect
    ? Math.min(Math.max(rect.x + rect.width / 2 - 10, spacing.xl), width - spacing.xl - 20)
    : 0;
  const next = () => (last ? onDone() : setIndex((i) => i + 1));

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        {rect ? (
          <>
            {/* The screen dims around a rounded hole: the lit element keeps its own shape. */}
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path d={holePath(width, height, rect, radius)} fill={DIM} fillRule="evenodd" />
            </Svg>
            <View
              pointerEvents="none"
              style={[
                styles.frame,
                {
                  top: rect.y,
                  left: rect.x,
                  width: rect.width,
                  height: rect.height,
                  borderRadius: radius,
                },
              ]}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />
        )}

        <Animated.View
          key={step.target}
          entering={reduced ? FadeIn : FadeInDown.duration(260)}
          style={[styles.bubbleWrap, { top: place.top }]}
          accessibilityLiveRegion="polite"
          // Placed with its real height, so it never covers the element it points at.
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (Math.abs(h - bubbleHeight) > 2) setBubbleHeight(h);
          }}
        >
          {place.arrow === 'up' ? <View style={[styles.arrowUp, { left: arrowLeft }]} /> : null}
          <View style={styles.bubble}>
            <Text variant="label" color={colors.accent}>
              {step.eyebrow}
            </Text>
            <Text variant="headline">{step.title}</Text>
            <Text variant="body" color="#C9CACE">
              {step.body}
            </Text>
            <View style={styles.actions}>
              <PressableScale
                onPress={onDone}
                accessibilityRole="button"
                accessibilityLabel="Passer le tutoriel"
                style={styles.skip}
              >
                <Text variant="bodyStrong" color={colors.muted}>
                  Passer
                </Text>
              </PressableScale>
              <Text variant="caption" color={colors.muted}>
                {`${index + 1} / ${steps.length}`}
              </Text>
              <PressableScale
                onPress={next}
                accessibilityRole="button"
                accessibilityLabel={last ? "C'est parti" : 'Suivant'}
                style={styles.next}
              >
                <Text variant="bodyStrong" color={colors.ink}>
                  {last ? "C'est parti" : 'Suivant →'}
                </Text>
              </PressableScale>
            </View>
          </View>
          {place.arrow === 'down' ? <View style={[styles.arrowDown, { left: arrowLeft }]} /> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const ARROW = 10;

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    borderRadius: radii.glass,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  bubbleWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  skip: { minHeight: minTouch, justifyContent: 'center', paddingRight: spacing.md },
  next: {
    minHeight: minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    backgroundColor: colors.accent,
  },
  arrowUp: {
    width: 0,
    height: 0,
    marginLeft: -spacing.lg,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderBottomWidth: ARROW,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.card,
  },
  arrowDown: {
    width: 0,
    height: 0,
    marginLeft: -spacing.lg,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderTopWidth: ARROW,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.card,
  },
});
