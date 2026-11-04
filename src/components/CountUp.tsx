import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { Text, type TextProps } from '@/components/ui/Text';

type Props = Omit<TextProps, 'children'> & {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
};

/** Number that rolls up (or down) to its value; jumps straight there when motion is reduced. */
export function CountUp({ value, format = String, durationMs = 700, ...rest }: Props) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduced || start === value) {
      setShown(value);
      return;
    }
    const t0 = Date.now();
    let frame = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced, durationMs]);

  return (
    <Text {...rest} accessibilityLabel={rest.accessibilityLabel ?? format(value)}>
      {format(shown)}
    </Text>
  );
}
