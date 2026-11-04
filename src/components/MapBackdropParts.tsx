import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** Stylised streets when no map provider is available. */
export function DrawnStreets() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
      <Rect x={0} y={0} width={390} height={844} fill={colors.map} />
      {[
        [-20, 140, 420, 260],
        [-20, 520, 420, 380],
        [60, -20, 140, 880],
        [250, -20, 310, 880],
        [-20, 700, 420, 760],
        [150, 300, 420, 330],
      ].map(([x1, y1, x2, y2]) => (
        <Line
          key={`${x1}-${y1}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#0B0C0E"
          strokeWidth={14}
        />
      ))}
      {[
        [-20, 420, 420, 440],
        [200, -20, 180, 880],
      ].map(([x1, y1, x2, y2]) => (
        <Line
          key={`${x1}-${y1}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#0B0C0E"
          strokeWidth={24}
        />
      ))}
    </Svg>
  );
}

/** The gym: an orange dot that pulses, at the centre of the map. */
export function GymPulse() {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!reduced) pulse.value = withRepeat(withTiming(1, { duration: 1800 }), -1, false);
  }, [pulse, reduced]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + 2.2 * pulse.value }],
  }));
  return (
    <View style={mapStyles.pulseWrap}>
      <Animated.View style={[mapStyles.pulseRing, ring]} />
      <View style={mapStyles.pulseDot} />
    </View>
  );
}

export const mapStyles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(17,18,20,0.35)' },
  pulseWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
  },
  pulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
