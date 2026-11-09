import {
  awardBelts,
  bestStreak,
  currentStreak,
  type HistoryWeek,
  jokerState,
  LEVELS,
  levelFor,
  monthLabel,
  trophyLabel,
} from './progression';

const week = (weekStart: string, achieved: boolean, extra: Partial<HistoryWeek> = {}) => ({
  weekStart,
  achieved,
  usedJoker: false,
  exempt: false,
  ...extra,
});

describe('levels', () => {
  it('starts on the empty bar', () => {
    expect(levelFor(0)).toMatchObject({
      kg: 20,
      level: LEVELS[0],
      next: LEVELS[1],
      progress: 0,
      sessionsToNext: 16,
    });
  });

  it('crosses each threshold at the exact kilos', () => {
    expect(levelFor(16).level.name).toBe('Gym bro'); // 60 kg
    expect(levelFor(15).level.name).toBe('Barre à vide'); // 57.5 kg
    expect(levelFor(32).level.name).toBe('Machine'); // 100 kg
    expect(levelFor(56).level.name).toBe('Monstre'); // 160 kg
    expect(levelFor(92).level.name).toBe('Légende'); // 250 kg
  });

  it('progress towards the next level', () => {
    const s = levelFor(24); // 80 kg, between 60 and 100
    expect(s.progress).toBeCloseTo(0.5);
    expect(s.sessionsToNext).toBe(8);
  });

  it('Légende is the top', () => {
    expect(levelFor(500)).toMatchObject({ next: null, progress: 1, sessionsToNext: 0 });
    expect(levelFor(-3).kg).toBe(20);
  });
});

describe('streaks', () => {
  const history = [
    week('2026-11-02', true),
    week('2026-10-26', false, { usedJoker: true }),
    week('2026-10-19', true),
    week('2026-10-12', false),
    week('2026-10-05', true),
    week('2026-09-28', true),
    week('2026-09-21', false, { exempt: true }),
    week('2026-09-14', true),
  ];

  it('current streak: a joker keeps it alive', () => {
    expect(currentStreak(history)).toBe(2);
  });

  it('best streak: a late-join week (exempt) does not break it', () => {
    expect(bestStreak(history)).toBe(3);
  });

  it('an exempt week where the goal was reached still counts', () => {
    expect(currentStreak([week('2026-11-02', true, { exempt: true })])).toBe(1);
  });

  it('a missing week breaks the best streak', () => {
    expect(bestStreak([week('2026-11-02', true), week('2026-10-19', true)])).toBe(1);
    expect(bestStreak([])).toBe(0);
    expect(currentStreak([])).toBe(0);
  });
});

describe('seasons', () => {
  it('French month labels with elision', () => {
    expect(monthLabel('2026-09-01')).toBe('septembre 2026');
    expect(trophyLabel('belt', '2026-09-01')).toBe('Ceinture de septembre');
    expect(trophyLabel('belt', '2026-10-01')).toBe("Ceinture d'octobre");
    expect(trophyLabel('big_canap', '2026-08-01')).toBe("Gros Canap' d'août");
    expect(trophyLabel('big_canap', '2027-01-01')).toBe("Gros Canap' de janvier");
  });

  it('awards like the SQL scenario', () => {
    expect(
      awardBelts([
        { id: 'karim', counted: 4, achieved: 4, sessions: 12, skips: 0 },
        { id: 'maxime', counted: 4, achieved: 3, sessions: 13, skips: 1 },
        { id: 'sofiane', counted: 2, achieved: 1, sessions: 4, skips: 1 },
      ]),
    ).toEqual({ belt: 'karim', bigCanap: 'sofiane' });
  });

  it('tie-breaks: sessions, then join order; nothing without a goal or a skip', () => {
    expect(
      awardBelts([
        { id: 'a', counted: 2, achieved: 2, sessions: 6, skips: 0 },
        { id: 'b', counted: 4, achieved: 4, sessions: 9, skips: 0 },
      ]).belt,
    ).toBe('b');
    expect(
      awardBelts([
        { id: 'a', counted: 2, achieved: 2, sessions: 6, skips: 0 },
        { id: 'b', counted: 2, achieved: 2, sessions: 6, skips: 0 },
      ]).belt,
    ).toBe('a');
    expect(
      awardBelts([
        { id: 'a', counted: 3, achieved: 0, sessions: 1, skips: 0 },
        { id: 'b', counted: 0, achieved: 0, sessions: 0, skips: 0 },
      ]),
    ).toEqual({ belt: null, bigCanap: null });
  });

  it('joker button states', () => {
    expect(jokerState({ jokerThisWeek: true, jokerMonthUsed: true })).toBe('active');
    expect(jokerState({ jokerThisWeek: false, jokerMonthUsed: true })).toBe('used');
    expect(jokerState({ jokerThisWeek: false, jokerMonthUsed: false })).toBe('available');
  });
});
