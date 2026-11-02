/** WCAG 2.x contrast helpers, used to check the palette (text ≥ 4.5:1). */

export type Rgba = { r: number; g: number; b: number; a: number };

export function parseColor(input: string): Rgba {
  const value = input.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`Unsupported color: ${input}`);
}

/** Alpha-composites `top` over an opaque `bottom`. */
export function composite(top: string, bottom: string): Rgba {
  const t = parseColor(top);
  const b = parseColor(bottom);
  const mix = (x: number, y: number) => Math.round(x * t.a + y * (1 - t.a));
  return { r: mix(t.r, b.r), g: mix(t.g, b.g), b: mix(t.b, b.b), a: 1 };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: Rgba): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrastRatio(fg: string | Rgba, bg: string | Rgba): number {
  const a = relativeLuminance(typeof fg === 'string' ? parseColor(fg) : fg);
  const b = relativeLuminance(typeof bg === 'string' ? parseColor(bg) : bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
