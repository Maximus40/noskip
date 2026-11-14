import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Props = { color: string; size?: number };

/** Loaded barbell: the team screen. */
export function BarIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Rect x={4.5} y={6} width={3} height={12} rx={1.2} fill={color} />
      <Rect x={16.5} y={6} width={3} height={12} rx={1.2} fill={color} />
    </Svg>
  );
}

/** Two overlapping heads: my teams. */
export function TeamsIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8.5} r={3.5} stroke={color} strokeWidth={2} />
      <Circle cx={16.5} cy={9.5} r={2.8} stroke={color} strokeWidth={2} />
      <Path
        d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5M15.5 14.6c2.6 0 4.9 1.4 6 4.4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Lifter card. */
export function CardIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={3} width={16} height={18} rx={3} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={10} r={2.8} stroke={color} strokeWidth={2} />
      <Path d="M8 17h8" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Settings sliders. */
export function SettingsIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M4 17h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={9} cy={7} r={2.4} fill="#111214" stroke={color} strokeWidth={2} />
      <Circle cx={15} cy={17} r={2.4} fill="#111214" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

/** Shopping bag: the shop. */
export function BagIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 8h14l-1.2 12H6.2L5 8Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M9 10V7a3 3 0 0 1 6 0v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
