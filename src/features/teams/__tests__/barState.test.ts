import { barState } from '../useBarState';
import type { BoardRow } from '../api';

const row = (over: Partial<BoardRow>): BoardRow => ({
  user_id: 'u',
  pseudo: 'U',
  avatar_url: null,
  title: 'machine',
  plate_color: '#B9BBC0',
  role: 'member',
  goal: 3,
  done: 0,
  today_status: 'not_yet',
  joker_this_week: false,
  is_me: false,
  ...over,
});

const friday = Date.parse('2026-11-06T08:00:00Z');

describe('barState', () => {
  it('builds plates, kilos and risks from the board', () => {
    const state = barState(
      [
        row({ user_id: 'me', is_me: true, done: 2, pseudo: 'Moi' }),
        row({ user_id: 'k', done: 0, goal: 3, pseudo: null }),
      ],
      friday,
    );
    expect(state.kg).toBe(40);
    expect(state.plates.every((p) => p.color === '#FF6A3D')).toBe(true);
    expect(state.players[1].pseudo).toBe('Un pote');
    expect(state.players[1].risk).toBe('shaky');
    expect(state.shaky).toBe(true);
    expect(state.pr).toBe(false);
  });

  it('flags a team PR when everybody is done', () => {
    const state = barState([row({ done: 3 }), row({ user_id: 'b', done: 4, goal: 4 })], friday);
    expect(state.pr).toBe(true);
    expect(state.shaky).toBe(false);
  });
});
