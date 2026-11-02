import { colors } from '../theme/tokens';
import { composite, contrastRatio, parseColor } from './contrast';

describe('contrast helpers', () => {
  it('parses hex and rgba', () => {
    expect(parseColor('#FF6A3D')).toEqual({ r: 255, g: 106, b: 61, a: 1 });
    expect(parseColor('rgba(30,31,35,0.66)')).toEqual({ r: 30, g: 31, b: 35, a: 0.66 });
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(() => parseColor('red')).toThrow('Unsupported color');
  });

  it('computes the reference black/white ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });
});

describe('palette meets WCAG AA (4.5:1) for text', () => {
  const glassOnMap = composite(colors.glass, colors.map);
  // Worst case: frosted glass sitting over a light street label.
  const glassOnLight = composite(colors.glass, '#3A3B40');

  it.each([
    ['offWhite on bg', colors.offWhite, colors.bg],
    ['muted on bg', colors.muted, colors.bg],
    ['muted on card', colors.muted, colors.card],
    ['offWhite on card', colors.offWhite, colors.card],
    ['accent on bg', colors.accent, colors.bg],
    ['ink on paper', colors.ink, colors.paper],
    ['ink on accent', colors.ink, colors.accent],
  ])('%s', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps text readable on glass panels', () => {
    expect(contrastRatio(colors.offWhite, glassOnMap)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.muted, glassOnMap)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.muted, glassOnLight)).toBeGreaterThanOrEqual(4.5);
  });
});
