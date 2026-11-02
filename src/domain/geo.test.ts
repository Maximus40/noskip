import { coarse, distanceMeters, formatDistance } from './geo';

describe('geo', () => {
  it('coarsens coordinates to ~1 km', () => {
    expect(coarse(50.631234)).toBe(50.63);
    expect(coarse(-3.0659)).toBe(-3.07);
  });

  it('computes distances', () => {
    expect(distanceMeters(50.63, 3.06, 50.63, 3.06)).toBe(0);
    // Lille → Paris ≈ 204 km
    expect(distanceMeters(50.6292, 3.0573, 48.8566, 2.3522) / 1000).toBeCloseTo(204, -1);
  });

  it('formats distances in French', () => {
    expect(formatDistance(3)).toBe('10 m');
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(18400)).toBe('18 km');
  });
});
