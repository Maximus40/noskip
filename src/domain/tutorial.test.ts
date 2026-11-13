import { bubblePlacement, TEAM_TUTORIAL } from './tutorial';

describe('team tutorial', () => {
  it('walks through the bar, the players, the session button and the history', () => {
    expect(TEAM_TUTORIAL.map((s) => s.target)).toEqual(['bar', 'players', 'session', 'history']);
  });

  it('puts the bubble under the element when there is room', () => {
    expect(bubblePlacement({ x: 0, y: 100, width: 300, height: 120 }, 800, 180)).toEqual({
      top: 234,
      arrow: 'up',
    });
  });

  it('puts it above an element at the bottom of the screen', () => {
    expect(bubblePlacement({ x: 0, y: 700, width: 70, height: 70 }, 800, 180)).toEqual({
      top: 506,
      arrow: 'down',
    });
  });

  it('centres it when the element cannot be measured', () => {
    expect(bubblePlacement(null, 800, 200)).toEqual({ top: 300, arrow: 'none' });
  });
});
