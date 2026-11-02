import Svg, { Path } from 'react-native-svg';

type Props = { color: string; size?: number };

export function ArrowUpRight({ color, size = 18 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 17 17 7M8 7h9v9"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
