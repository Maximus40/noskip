import { isPrefOn, NOTIFICATION_PREFS, routeForNotification, withPref } from './notifications';

describe('routeForNotification', () => {
  it('opens the SKIP card, or the recap, or the bar', () => {
    expect(routeForNotification({ type: 'skip', card_id: 'c1', week_id: 'w1' }, 'me')).toEqual({
      pathname: '/skip/[id]',
      params: { id: 'c1' },
    });
    expect(routeForNotification({ type: 'skip', week_id: 'w1' }, 'me')).toEqual({
      pathname: '/recap/[weekId]',
      params: { weekId: 'w1' },
    });
    expect(routeForNotification({ type: 'skip' }, 'me')).toEqual({ pathname: '/team' });
  });

  it('recap and team PR open the recap', () => {
    for (const type of ['recap', 'team_pr']) {
      expect(routeForNotification({ type, week_id: 'w9' }, 'me')).toEqual({
        pathname: '/recap/[weekId]',
        params: { weekId: 'w9' },
      });
      expect(routeForNotification({ type }, 'me')).toEqual({ pathname: '/team' });
    }
  });

  it('a belt opens the winner’s card (mine on my tab)', () => {
    expect(routeForNotification({ type: 'belt', user_id: 'karim' }, 'me')).toEqual({
      pathname: '/lifter/[id]',
      params: { id: 'karim' },
    });
    expect(routeForNotification({ type: 'belt', user_id: 'me' }, 'me')).toEqual({
      pathname: '/lifter',
    });
    expect(routeForNotification({ type: 'belt' }, null)).toEqual({ pathname: '/lifter' });
  });

  it('live game pushes open the bar', () => {
    for (const type of ['plate_loaded', 'spot', 'shaky', 'shaky_self', 'gym_change']) {
      expect(routeForNotification({ type }, 'me')).toEqual({ pathname: '/team' });
    }
  });

  it('ignores unknown payloads', () => {
    expect(routeForNotification(null, 'me')).toBeNull();
    expect(routeForNotification('skip', 'me')).toBeNull();
    expect(routeForNotification({ type: 'promo' }, 'me')).toBeNull();
    expect(routeForNotification({ type: 'skip', card_id: '' }, 'me')).toEqual({
      pathname: '/team',
    });
  });
});

describe('preferences', () => {
  it('on by default, off only when explicitly false', () => {
    expect(isPrefOn(null, 'skip')).toBe(true);
    expect(isPrefOn({}, 'skip')).toBe(true);
    expect(isPrefOn({ skip: false }, 'skip')).toBe(false);
    expect(isPrefOn({ skip: 'no' }, 'skip')).toBe(true);
  });

  it('toggles one key and keeps the others', () => {
    expect(withPref({ spot: false, gym_change: true }, 'skip', false)).toEqual({
      spot: false,
      gym_change: true,
      skip: false,
    });
    expect(withPref(null, 'spot', true)).toEqual({ spot: true });
  });

  it('lists every type the server sends', () => {
    expect(NOTIFICATION_PREFS.map((p) => p.key).sort()).toEqual(
      ['gym_change', 'plate_loaded', 'recap', 'shaky_bar', 'skip', 'spot', 'team_pr'].sort(),
    );
  });
});
