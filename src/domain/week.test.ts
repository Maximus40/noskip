import { gameWeekStart, isAfterDeadline, parisDate, sessionDaysLeft, weekRisk } from './week';

// Week of Monday 2 Nov 2026 (CET, UTC+1).
const at = (iso: string) => Date.parse(iso);

describe('Paris game week', () => {
  it('uses the Paris calendar day', () => {
    expect(parisDate(at('2026-11-02T23:30:00Z'))).toBe('2026-11-03');
    expect(parisDate(at('2026-06-14T22:30:00Z'))).toBe('2026-06-15'); // CEST
  });

  it('closes on Sunday 20:00 Paris', () => {
    expect(isAfterDeadline(at('2026-11-08T18:59:00Z'))).toBe(false);
    expect(isAfterDeadline(at('2026-11-08T19:00:00Z'))).toBe(true);
    expect(gameWeekStart(at('2026-11-08T18:59:00Z'))).toBe('2026-11-02');
    expect(gameWeekStart(at('2026-11-08T19:00:00Z'))).toBe('2026-11-09');
    expect(gameWeekStart(at('2026-11-02T00:30:00Z'))).toBe('2026-11-02');
    expect(gameWeekStart(at('2026-06-14T18:00:00Z'))).toBe('2026-06-15'); // CEST
  });

  it('counts the days left including today', () => {
    expect(sessionDaysLeft(at('2026-11-02T08:00:00Z'))).toBe(7); // Monday
    expect(sessionDaysLeft(at('2026-11-06T08:00:00Z'))).toBe(3); // Friday
    expect(sessionDaysLeft(at('2026-11-08T10:00:00Z'))).toBe(1); // Sunday morning
    expect(sessionDaysLeft(at('2026-11-08T20:00:00Z'))).toBe(7); // Sunday 21:00 → next week
  });
});

describe('weekRisk', () => {
  const friday = at('2026-11-06T08:00:00Z'); // 3 days left: Fri, Sat, Sun

  it('classifies a player', () => {
    expect(weekRisk({ goal: 3, done: 3, doneToday: false }, friday)).toBe('achieved');
    expect(weekRisk({ goal: 3, done: 1, doneToday: false }, friday)).toBe('safe');
    expect(weekRisk({ goal: 4, done: 1, doneToday: false }, friday)).toBe('shaky');
    expect(weekRisk({ goal: 5, done: 1, doneToday: false }, friday)).toBe('lost');
  });

  it('does not count today twice once today is done', () => {
    expect(weekRisk({ goal: 4, done: 2, doneToday: true }, friday)).toBe('shaky');
    expect(weekRisk({ goal: 5, done: 2, doneToday: true }, friday)).toBe('lost');
  });

  it('protects a player with a joker', () => {
    expect(weekRisk({ goal: 5, done: 0, doneToday: false, joker: true }, friday)).toBe('safe');
  });
});
