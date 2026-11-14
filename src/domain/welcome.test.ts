import { platesFor } from './bar';
import { WELCOME_DEMO_TEAM, WELCOME_SLIDES } from './welcome';

describe('welcome pages', () => {
  it('tell the game in three pages: team, plate, SKIP', () => {
    expect(WELCOME_SLIDES.map((s) => s.key)).toEqual(['hero', 'team', 'plate', 'skip']);
    for (const s of WELCOME_SLIDES) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeLessThanOrEqual(200);
    }
  });

  it('the demo team loads a few plates, yours on the outside', () => {
    const plates = platesFor(WELCOME_DEMO_TEAM.players, '#FF6A3D');
    expect(plates).toHaveLength(5);
    expect(plates.at(-1)?.isMe).toBe(true);
  });
});
