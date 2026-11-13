import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { type Plate, plateWidth } from '@/domain/bar';
import { type PlateSkin, SKIN_PAINT } from '@/domain/shop';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Geometry of design/html/V3-Disque.html (viewBox 350 × 110).
const W = 350;
const H = 110;
const LEFT_COLLAR = 133; // plates stack outwards from here (leftwards)
const RIGHT_COLLAR = 217; // and from here (rightwards)
const SLEEVE = 125;
const GAP = 3;
const PLATE_Y = 8;
const PLATE_H = 94;

type Props = {
  plates: Plate[];
  /** Key of the plate that just landed: it slides on with a bounce. */
  newPlateKey?: string | null;
  /** "La barre tremble": a player can only make it by going every remaining day. */
  shaky?: boolean;
  width?: number;
  accessibilityLabel: string;
};

/** The team barbell. Each sleeve shows the same stack (one 20 kg session = 2 × 10 kg plates). */
export function TeamBar({
  plates,
  newPlateKey,
  shaky = false,
  width = 330,
  accessibilityLabel,
}: Props) {
  const reduced = useReducedMotion();
  const w = plateWidth(plates.length, SLEEVE, GAP);
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (shaky && !reduced) {
      wobble.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 90 }),
          withTiming(-1, { duration: 180 }),
          withTiming(0, { duration: 90 }),
          withDelay(1400, withTiming(0, { duration: 1 })),
        ),
        -1,
        false,
      );
    } else {
      wobble.value = withTiming(0, { duration: 150 });
    }
  }, [shaky, reduced, wobble]);

  const wobbleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wobble.value * 1.6}deg` }, { translateY: Math.abs(wobble.value) * 2 }],
  }));

  return (
    <Animated.View
      style={wobbleStyle}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ width, height: (width * H) / W }}>
        <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
          <Rect x={0} y={52} width={W} height={6} rx={3} fill="#8E9096" />
          <Rect x={148} y={50} width={54} height={10} rx={3} fill="#5E6066" />
          <Rect x={136} y={42} width={6} height={26} rx={2} fill="#C4C6CB" />
          <Rect x={208} y={42} width={6} height={26} rx={2} fill="#C4C6CB" />
          {plates.map((plate, i) => {
            const left = LEFT_COLLAR - (i + 1) * w - i * GAP;
            const right = RIGHT_COLLAR + i * (w + GAP);
            const isNew = plate.key === newPlateKey;
            return [
              <PlateRect
                key={`${plate.key}-l`}
                x={left}
                width={w}
                color={plate.color}
                skin={plate.skin}
                animateFrom={isNew ? -40 : null}
              />,
              <PlateRect
                key={`${plate.key}-r`}
                x={right}
                width={w}
                color={plate.color}
                skin={plate.skin}
                animateFrom={isNew ? 40 : null}
              />,
            ];
          })}
        </Svg>
      </View>
    </Animated.View>
  );
}

function PlateRect({
  x,
  width,
  color,
  skin,
  animateFrom,
}: {
  x: number;
  width: number;
  color: string;
  skin?: PlateSkin;
  animateFrom: number | null;
}) {
  const paint = SKIN_PAINT[skin ?? 'classic'];
  const reduced = useReducedMotion();
  const offset = useSharedValue(animateFrom ?? 0);
  const opacity = useSharedValue(animateFrom === null ? 1 : 0);

  useEffect(() => {
    if (animateFrom === null) return;
    if (reduced) {
      offset.value = 0;
      opacity.value = withTiming(1, { duration: 300 });
      return;
    }
    // Slides onto the sleeve, overshoots by ~3 units, settles (ns-drop in the mockup).
    offset.value = withDelay(300, withSpring(0, { damping: 9, stiffness: 140, mass: 0.7 }));
    opacity.value = withDelay(300, withTiming(1, { duration: 200 }));
  }, [animateFrom, reduced, offset, opacity]);

  const animatedProps = useAnimatedProps(() => ({ x: x + offset.value, opacity: opacity.value }));
  // Shop skins: a stripe through the middle of the plate (carbon weave, chrome reflection).
  const stripeProps = useAnimatedProps(() => ({
    x: x + offset.value + width * 0.35,
    opacity: opacity.value,
  }));
  return (
    <>
      <AnimatedRect
        y={PLATE_Y}
        width={width}
        height={PLATE_H}
        rx={3}
        fill={paint.body ?? color}
        stroke={paint.rim ?? undefined}
        strokeWidth={paint.rim ? 1.5 : 0}
        animatedProps={animatedProps}
      />
      {paint.stripe ? (
        <AnimatedRect
          y={PLATE_Y + 10}
          width={width * 0.3}
          height={PLATE_H - 20}
          rx={1.5}
          fill={paint.stripe}
          animatedProps={stripeProps}
        />
      ) : null}
    </>
  );
}
