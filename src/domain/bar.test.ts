import {
  allAchieved,
  type BarPlayer,
  canSpot,
  formatKg,
  personalBarKg,
  plateLoadedLine,
  platesFor,
  plateWidth,
  statusLabel,
  teamKg,
} from './bar';

const p = (over: Partial<BarPlayer>): BarPlayer => ({
  id: 'x',
  pseudo: 'X',
  color: '#B9BBC0',
  isMe: false,
  goal: 3,
  done: 0,
  status: 'not_yet',
  joker: false,
  ...over,
});

describe('team bar', () => {
  const team = [
    p({ id: 'me', isMe: true, done: 3, color: '#F5F5F0' }),
    p({ id: 'k', done: 2, color: '#7C7E84' }),
    p({ id: 's', done: 0, color: '#B9BBC0' }),
  ];

  it('loads one plate per session, teammates near the collar, me outside in orange', () => {
    const plates = platesFor(team, '#FF6A3D');
    expect(plates.map((x) => x.color)).toEqual([
      '#7C7E84',
      '#7C7E84',
      '#FF6A3D',
      '#FF6A3D',
      '#FF6A3D',
    ]);
    expect(new Set(plates.map((x) => x.key)).size).toBe(5);
  });

  it('counts 20 kg per session', () => {
    expect(teamKg(team)).toBe(100);
    expect(teamKg([])).toBe(0);
  });

  it('fits plates on the sleeve', () => {
    expect(plateWidth(0, 120)).toBe(13);
    expect(plateWidth(8, 128)).toBe(13);
    expect(plateWidth(20, 128)).toBe(4);
    expect(plateWidth(12, 128)).toBeCloseTo((128 - 33) / 12);
  });

  it('detects a team PR week', () => {
    expect(allAchieved([])).toBe(false);
    expect(allAchieved(team)).toBe(false);
    expect(allAchieved([p({ done: 3 }), p({ done: 4, goal: 4 })])).toBe(true);
  });
});

describe('labels and rules', () => {
  it('labels statuses in French', () => {
    expect(statusLabel('done')).toBe('Fait');
    expect(statusLabel('at_gym')).toBe('À la salle');
    expect(statusLabel('not_yet')).toBe('Pas encore');
  });

  it('decides who can be spotted', () => {
    expect(canSpot(p({}), 'safe')).toBe(true);
    expect(canSpot(p({ isMe: true }), 'safe')).toBe(false);
    expect(canSpot(p({ status: 'done' }), 'safe')).toBe(false);
    expect(canSpot(p({ joker: true }), 'shaky')).toBe(false);
    expect(canSpot(p({}), 'achieved')).toBe(false);
  });

  it('formats kilos the French way', () => {
    expect(formatKg(160)).toBe('160');
    expect(formatKg(87.5)).toBe('87,5');
    expect(formatKg(1240)).toBe('1 240');
  });

  it('computes the personal bar', () => {
    expect(personalBarKg(0)).toBe(20);
    expect(personalBarKg(27)).toBe(87.5);
  });

  it('writes the plate-loaded line', () => {
    expect(plateLoadedLine(1, 3)).toBe('Ton 1er disque. Encore 2 pour boucler la semaine.');
    expect(plateLoadedLine(3, 3)).toBe('Ton 3e disque. Objectif de la semaine bouclé.');
  });
});
