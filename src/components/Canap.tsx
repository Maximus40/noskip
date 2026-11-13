/**
 * Le Canap' — the mascot, ported from design/html/Canap-*.html (viewBox 240×200).
 * Each mood animates separate parts with Reanimated; "Réduire les animations" shows the pose
 * without motion. To swap for a Rive/Lottie file later, keep this component's props and
 * replace the body of <Canap /> (see CanapArt below).
 */
import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
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
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

export type CanapMood =
  'idle' | 'smug' | 'sad' | 'crushed' | 'laughing' | 'cool' | 'evil' | 'sleepy' | 'wink';

/** How the body moves: the 4 original moods, and the new faces reuse one of them. */
type Motion = 'idle' | 'smug' | 'sad' | 'crushed';
const MOTION: Record<CanapMood, Motion> = {
  idle: 'idle',
  smug: 'smug',
  sad: 'sad',
  crushed: 'crushed',
  laughing: 'smug',
  cool: 'idle',
  evil: 'smug',
  sleepy: 'idle',
  wink: 'idle',
};

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const LABELS: Record<CanapMood, string> = {
  idle: "Le Canap' au repos, qui respire tranquillement",
  smug: "Le Canap' qui ricane parce que quelqu'un a skip",
  sad: "Le Canap' qui boude parce qu'un disque a été chargé",
  crushed: "Le Canap' écrasé par la barre de la team après un PR",
  laughing: "Le Canap' mort de rire",
  cool: "Le Canap' en lunettes de soleil, très content de lui",
  evil: "Le Canap' en boss final, sourire diabolique",
  sleepy: "Le Canap' qui dort, avec des Z au-dessus de lui",
  wink: "Le Canap' qui fait un clin d'œil",
};

const VIEW_W = 240;
const VIEW_H = 200;

type Props = { mood: CanapMood; size?: number; style?: ViewStyle; accessible?: boolean };

export function Canap({ mood, size = 240, style, accessible = true }: Props) {
  const height = (size * VIEW_H) / VIEW_W;
  return (
    <View
      style={[{ width: size, height }, style]}
      accessible={accessible}
      accessibilityRole="image"
      accessibilityLabel={LABELS[mood]}
    >
      <CanapArt mood={mood} width={size} height={height} />
    </View>
  );
}

function CanapArt({ mood, width, height }: { mood: CanapMood; width: number; height: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const motion = MOTION[mood];

  useEffect(() => {
    t.value = 0;
    if (reduced) {
      if (motion === 'crushed') t.value = 1;
      return;
    }
    const loop = (ms: number) =>
      withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, false);
    if (motion === 'idle') t.value = loop(mood === 'sleepy' ? 4200 : 3200);
    else if (motion === 'smug')
      t.value = withRepeat(
        withTiming(1, { duration: mood === 'laughing' ? 800 : 1100, easing: Easing.linear }),
        -1,
        false,
      );
    else if (motion === 'sad') t.value = loop(2600);
    else t.value = withSpring(1, { damping: 6, stiffness: 180, mass: 0.6 });
  }, [mood, motion, reduced, t]);

  // Body motion, pivoting near the feet (transform-origin 50% 92%).
  const body = useAnimatedStyle(() => {
    const v = t.value;
    const wave = Math.sin(v * Math.PI * 2); // 0 → 1 → 0 → -1 → 0
    const half = Math.sin(v * Math.PI); // 0 → 1 → 0
    switch (motion) {
      case 'idle':
        return { transform: [{ scaleY: 1 + 0.035 * half }] };
      case 'smug': {
        // Bouncing laugh with a slight wobble, damped over the cycle.
        const damp = 1 - v;
        return {
          transform: [
            { translateY: -10 * Math.abs(Math.sin(v * Math.PI * 3)) * damp * (height / VIEW_H) },
            { rotate: `${-3 * wave * damp}deg` },
          ],
        };
      }
      case 'sad':
        return {
          transform: [{ translateX: -3 * half * (width / VIEW_W) }, { scaleY: 1 - 0.05 * half }],
        };
      case 'crushed':
        return { transform: [{ scaleX: 1 + 0.14 * v }, { scaleY: 1 - 0.4 * v }] };
    }
  });

  // Eyelids drop for a blink every ~4.2 s (idle only).
  const blink = useSharedValue(0);
  useEffect(() => {
    if (reduced || mood !== 'idle') {
      blink.value = 0;
      return;
    }
    blink.value = withRepeat(
      withSequence(
        withDelay(3800, withTiming(1, { duration: 120 })),
        withTiming(0, { duration: 160 }),
      ),
      -1,
      false,
    );
  }, [blink, mood, reduced]);
  const lidProps = useAnimatedProps(() => ({ height: 11 + 15 * blink.value }));

  // Falling chip crumbs (smug) and chalk cloud (crushed).
  const fall = useSharedValue(0);
  useEffect(() => {
    if (reduced || (motion !== 'smug' && motion !== 'crushed')) {
      fall.value = 0;
      return;
    }
    fall.value = withRepeat(
      withTiming(1, { duration: motion === 'smug' ? 1100 : 1600 }),
      -1,
      false,
    );
  }, [fall, motion, reduced]);
  const crumbA = useCrumb(fall, 0, 96);
  const crumbB = useCrumb(fall, 0.32, 98);
  const crumbC = useCrumb(fall, 0.64, 95);
  const dustA = useDust(fall, 0, 150);
  const dustB = useDust(fall, 0.19, 148);
  const dustC = useDust(fall, 0.38, 160);
  const dustD = useDust(fall, 0.56, 162);

  const tone =
    mood === 'sad'
      ? { back: '#262626', seat: '#1C1C1C', arm: '#333333', button: '#141414' }
      : { back: '#2B2B2B', seat: '#1F1F1F', arm: '#3A3A3A', button: '#1F1F1F' };

  return (
    <View style={{ width, height }}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={StyleSheet.absoluteFill}
      >
        <Ellipse
          cx={120}
          cy={186}
          rx={mood === 'crushed' ? 110 : 96}
          ry={mood === 'crushed' ? 9 : 8}
          fill="#000"
          opacity={0.18}
        />
        {mood === 'crushed' ? (
          <G>
            <AnimatedCircle cx={40} r={6} fill="#9A9A94" animatedProps={dustA} />
            <AnimatedCircle cx={200} r={7} fill="#9A9A94" animatedProps={dustB} />
            <AnimatedCircle cx={80} r={5} fill="#9A9A94" animatedProps={dustC} />
            <AnimatedCircle cx={165} r={5} fill="#9A9A94" animatedProps={dustD} />
          </G>
        ) : null}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 92%' }, body]}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Rect x={44} y={160} width={14} height={22} rx={3} fill="#111111" />
          <Rect x={182} y={160} width={14} height={22} rx={3} fill="#111111" />
          <Rect x={40} y={28} width={160} height={104} rx={36} fill={tone.back} />
          {mood !== 'crushed' ? (
            <>
              <Circle cx={70} cy={52} r={4} fill={tone.button} />
              <Circle cx={170} cy={52} r={4} fill={tone.button} />
            </>
          ) : null}
          <Rect x={30} y={112} width={180} height={52} rx={20} fill={tone.seat} />
          {mood !== 'crushed' ? (
            <Line x1={120} y1={116} x2={120} y2={160} stroke="#141414" strokeWidth={2} />
          ) : null}
          <Rect x={12} y={88} width={42} height={80} rx={20} fill={tone.arm} />
          <Rect x={186} y={88} width={42} height={80} rx={20} fill={tone.arm} />
          <Face mood={mood} lidProps={lidProps} lidColor={tone.back} />
          {mood !== 'crushed' ? (
            <Rect x={20} y={80} width={14} height={32} rx={5} fill="#26282D" />
          ) : null}
          {motion !== 'sad' && motion !== 'crushed' ? (
            <>
              <Circle cx={27} cy={88} r={3} fill="#FF6A3D" />
              <Rect
                x={196}
                y={54}
                width={28}
                height={36}
                rx={5}
                fill="#FF6A3D"
                transform="rotate(12 210 72)"
              />
              <Rect
                x={198}
                y={64}
                width={24}
                height={7}
                fill="#0E0F11"
                transform="rotate(12 210 72)"
              />
            </>
          ) : null}
          {mood === 'sad' ? (
            <Rect
              x={198}
              y={132}
              width={28}
              height={36}
              rx={5}
              fill="#B84A28"
              transform="rotate(80 212 150)"
            />
          ) : null}
          {motion === 'smug' ? (
            <G>
              <AnimatedCircle cx={204} r={2.5} fill="#FF6A3D" animatedProps={crumbA} />
              <AnimatedCircle cx={212} r={2} fill="#FF6A3D" animatedProps={crumbB} />
              <AnimatedCircle cx={220} r={2.5} fill="#FF6A3D" animatedProps={crumbC} />
            </G>
          ) : null}
          {mood === 'crushed' ? (
            <G>
              <Rect x={-10} y={14} width={260} height={10} rx={5} fill="#8A9099" />
              <Rect x={6} y={-12} width={14} height={62} rx={4} fill="#F5F5F0" />
              <Rect x={22} y={-12} width={14} height={62} rx={4} fill="#FF6A3D" />
              <Rect x={204} y={-12} width={14} height={62} rx={4} fill="#FF6A3D" />
              <Rect x={220} y={-12} width={14} height={62} rx={4} fill="#F5F5F0" />
            </G>
          ) : null}
        </Svg>
      </Animated.View>
    </View>
  );
}

/** A chip crumb falling 40 units and fading (phase-shifted by `delay`). */
function useCrumb(fall: SharedValue<number>, delay: number, baseY: number) {
  return useAnimatedProps(() => {
    const p = (fall.value + delay) % 1;
    return { cy: baseY + 40 * p, opacity: 1 - p };
  });
}

/** A chalk puff rising 60 units, fading in then out. */
function useDust(fall: SharedValue<number>, delay: number, baseY: number) {
  return useAnimatedProps(() => {
    const p = (fall.value + delay) % 1;
    return { cy: baseY - 60 * p, opacity: p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7 };
  });
}

type FaceProps = {
  mood: CanapMood;
  lidProps: ReturnType<typeof useAnimatedProps<{ height: number }>>;
  lidColor: string;
};

function Face({ mood, lidProps, lidColor }: FaceProps) {
  if (mood === 'crushed') {
    return (
      <G>
        <Path
          d="M88 70 L108 88 M108 70 L88 88"
          stroke="#F4F4EF"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path
          d="M132 70 L152 88 M152 70 L132 88"
          stroke="#F4F4EF"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path
          d="M104 106 Q120 100 136 106"
          stroke="#F5F5F0"
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
        />
        <Path d="M122 106 Q126 120 132 107" fill="#E57373" />
      </G>
    );
  }
  if (
    mood === 'laughing' ||
    mood === 'cool' ||
    mood === 'evil' ||
    mood === 'sleepy' ||
    mood === 'wink'
  )
    return <ExtraFace mood={mood} lidColor={lidColor} />;
  // Half-closed eyes: white ellipse, pupil, eyelid band and lash line.
  const eyeY = mood === 'sad' ? 80 : 78;
  const pupil =
    mood === 'smug' ? { dx: 5, dy: 3 } : mood === 'sad' ? { dx: -1, dy: 6 } : { dx: 2, dy: 2 };
  const lidY = mood === 'sad' ? 68 : 66;
  const lidH = mood === 'idle' ? 11 : mood === 'smug' ? 12 : 13;
  const eye = (cx: number) => (
    <G key={cx}>
      <Ellipse cx={cx} cy={eyeY} rx={14} ry={12} fill="#F4F4EF" />
      <Circle cx={cx + pupil.dx} cy={eyeY + pupil.dy} r={5} fill="#111214" />
      {mood === 'idle' ? (
        <AnimatedRect x={cx - 14} y={lidY} width={28} fill={lidColor} animatedProps={lidProps} />
      ) : (
        <Rect x={cx - 14} y={lidY} width={28} height={lidH} fill={lidColor} />
      )}
      <Line
        x1={cx - 14}
        y1={lidY + lidH}
        x2={cx + 14}
        y2={lidY + lidH}
        stroke="#F5F5F0"
        strokeWidth={2.5}
      />
    </G>
  );
  return (
    <G>
      {mood === 'smug' ? (
        <>
          <Path
            d="M84 60 Q98 52 112 60"
            stroke="#F5F5F0"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M128 64 Q142 64 156 60"
            stroke="#F5F5F0"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {mood === 'sad' ? (
        <>
          <Path
            d="M86 58 Q100 62 112 66"
            stroke="#F5F5F0"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M128 66 Q140 62 154 58"
            stroke="#F5F5F0"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {eye(98)}
      {eye(142)}
      {mood === 'idle' ? (
        <Path
          d="M108 104 Q120 109 134 104"
          stroke="#F5F5F0"
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
        />
      ) : null}
      {mood === 'smug' ? (
        <Path d="M100 98 Q120 118 144 96 Q122 108 100 98 Z" fill="#F5F5F0" />
      ) : null}
      {mood === 'sad' ? (
        <Path
          d="M106 110 Q120 100 136 110"
          stroke="#F5F5F0"
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
        />
      ) : null}
    </G>
  );
}

const INK = '#F5F5F0';
const stroke = { stroke: INK, strokeWidth: 3.5, fill: 'none', strokeLinecap: 'round' } as const;

/** Faces added for the premium SKIP posters: each poster has its own Canap'. */
function ExtraFace({
  mood,
  lidColor,
}: {
  mood: 'laughing' | 'cool' | 'evil' | 'sleepy' | 'wink';
  lidColor: string;
}) {
  switch (mood) {
    case 'laughing':
      // Eyes squeezed shut, mouth wide open, tears of laughter.
      return (
        <G>
          <Path d="M84 82 Q98 64 112 82" {...stroke} strokeWidth={4.5} />
          <Path d="M128 82 Q142 64 156 82" {...stroke} strokeWidth={4.5} />
          <Path
            d="M98 96 L144 96 Q140 126 121 126 Q102 126 98 96 Z"
            fill="#111214"
            stroke={INK}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Rect x={103} y={97.5} width={36} height={6} rx={2} fill={INK} />
          <Ellipse cx={121} cy={119} rx={10} ry={5} fill="#E57373" />
          <Path d="M78 88 Q74 96 78 100 Q83 96 78 88 Z" fill={INK} opacity={0.85} />
          <Path d="M162 88 Q158 96 162 100 Q167 96 162 88 Z" fill={INK} opacity={0.85} />
        </G>
      );
    case 'cool':
      // Sunglasses and a side smirk.
      return (
        <G>
          <Line x1={70} y1={74} x2={84} y2={72} stroke="#0B0B0C" strokeWidth={4} />
          <Line x1={170} y1={74} x2={156} y2={72} stroke="#0B0B0C" strokeWidth={4} />
          <Rect
            x={82}
            y={66}
            width={34}
            height={22}
            rx={7}
            fill="#0B0B0C"
            stroke={INK}
            strokeWidth={2.5}
          />
          <Rect
            x={124}
            y={66}
            width={34}
            height={22}
            rx={7}
            fill="#0B0B0C"
            stroke={INK}
            strokeWidth={2.5}
          />
          <Line x1={116} y1={74} x2={124} y2={74} stroke={INK} strokeWidth={2.5} />
          <Path
            d="M88 80 L96 70"
            stroke={INK}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.55}
          />
          <Path
            d="M130 80 L138 70"
            stroke={INK}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.55}
          />
          <Path d="M106 108 Q124 114 140 100" {...stroke} />
        </G>
      );
    case 'evil':
      // Final boss: V brows, narrowed orange eyes, toothy grin.
      return (
        <G>
          <Path d="M82 58 L112 70" {...stroke} strokeWidth={4.5} />
          <Path d="M158 58 L128 70" {...stroke} strokeWidth={4.5} />
          <Ellipse cx={98} cy={81} rx={13} ry={7} fill={INK} />
          <Ellipse cx={142} cy={81} rx={13} ry={7} fill={INK} />
          <Circle cx={101} cy={82} r={4.5} fill="#FF6A3D" />
          <Circle cx={139} cy={82} r={4.5} fill="#FF6A3D" />
          <Path d="M94 98 Q120 124 148 98 Z" fill={INK} />
          {[104, 113, 122, 131, 140].map((x) => (
            <Line key={x} x1={x} y1={98} x2={x} y2={108} stroke={lidColor} strokeWidth={2} />
          ))}
        </G>
      );
    case 'sleepy':
      // Fast asleep: closed eyes, little open mouth, Z Z Z.
      return (
        <G>
          <Path d="M86 80 Q98 88 110 80" {...stroke} />
          <Path d="M130 80 Q142 88 154 80" {...stroke} />
          <Ellipse cx={120} cy={106} rx={6} ry={5} fill="#111214" stroke={INK} strokeWidth={2.5} />
          <SvgText x={160} y={46} fill={INK} fontSize={14} fontWeight="900">
            Z
          </SvgText>
          <SvgText x={174} y={30} fill={INK} fontSize={19} fontWeight="900" opacity={0.8}>
            Z
          </SvgText>
          <SvgText x={190} y={12} fill={INK} fontSize={24} fontWeight="900" opacity={0.6}>
            Z
          </SvgText>
        </G>
      );
    case 'wink':
      // One eye open (raised brow), one winking, big grin: to the camera.
      return (
        <G>
          <Path d="M84 56 Q98 48 112 56" {...stroke} />
          <Ellipse cx={98} cy={78} rx={14} ry={12} fill={INK} />
          <Circle cx={102} cy={80} r={5} fill="#111214" />
          <Path d="M128 80 Q142 70 156 80" {...stroke} strokeWidth={4.5} />
          <Path d="M130 66 Q142 62 154 64" {...stroke} />
          <Path d="M100 98 Q121 124 144 98 Q121 110 100 98 Z" fill={INK} />
        </G>
      );
  }
}
