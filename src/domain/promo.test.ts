import { PROMO_GAP_DAYS, PROMOS, promoToShow, skipCardShopHint } from './promo';

const DAY = 86_400_000;
const base = { tutorialSeen: true, dismissedAt: null, owned: new Set<string>() };

describe('in-app offers', () => {
  it('waits for the tutorial to be done', () => {
    expect(promoToShow(Date.now(), { ...base, tutorialSeen: false })).toBeNull();
  });

  it('rotates by day and comes back only after the gap', () => {
    const now = 20_000 * DAY;
    expect(promoToShow(now, base)?.id).toBe(PROMOS[20_000 % PROMOS.length].id);
    expect(promoToShow(now + DAY, base)?.id).not.toBe(promoToShow(now, base)?.id);
    const closed = new Date(now - (PROMO_GAP_DAYS - 1) * DAY).toISOString();
    expect(promoToShow(now, { ...base, dismissedAt: closed })).toBeNull();
    const old = new Date(now - (PROMO_GAP_DAYS + 1) * DAY).toISOString();
    expect(promoToShow(now, { ...base, dismissedAt: old })).not.toBeNull();
  });

  it('never sells what the player already owns', () => {
    const owned = new Set(['noskip.shop.poster.all']);
    for (let d = 0; d < 10; d += 1) {
      const p = promoToShow(d * DAY, { ...base, owned });
      expect(p?.id).not.toBe('posters');
      expect(p?.id).not.toBe('bundle');
    }
    const everything = new Set([
      'noskip.shop.poster.all',
      ...['gold', 'carbon', 'chrome'].map((s) => `noskip.shop.skin.${s}`),
      ...['foot', 'gaming', 'braquage', 'telerealite', 'rap', 'manga', 'daron', 'horoscope'].map(
        (p) => `noskip.shop.pack.${p}`,
      ),
    ]);
    expect(promoToShow(0, { ...base, owned: everything })).toBeNull();
  });

  it('adapts the SKIP card hint to who is looking', () => {
    expect(skipCardShopHint(true, 'classic')).toMatch(/toi qui choisis/);
    expect(skipCardShopHint(false, 'classic')).toMatch(/carte premium/);
    expect(skipCardShopHint(false, 'neon')).toMatch(/impose ton style/);
  });
});
