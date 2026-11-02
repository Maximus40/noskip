import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

/** Pressable with a press/release micro-interaction (opacity only when motion is reduced). */
export function PressableScale({ children, style, pressedScale = 0.96, ...rest }: Props) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - pressed.value * 0.25 }
      : { transform: [{ scale: 1 - pressed.value * (1 - pressedScale) }] },
  );

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        pressed.value = reduced
          ? withTiming(1, { duration: 80 })
          : withSpring(1, { duration: 160 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = reduced
          ? withTiming(0, { duration: 120 })
          : withSpring(0, { duration: 260 });
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
