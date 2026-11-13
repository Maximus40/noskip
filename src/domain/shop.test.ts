import { SKIP_LINES } from '../../content/skip-lines';
import {
  isPlateSkin,
  packSamples,
  PLATE_SKINS,
  SHOP_ITEMS,
  SHOP_PRODUCT_IDS,
  SKIN_PAINT,
} from './shop';

describe('shop catalog', () => {
  it('only sells cosmetics, with ids the server accepts', () => {
    for (const id of SHOP_PRODUCT_IDS)
      expect(id).toMatch(/^noskip\.shop\.(skin|pack)\.[a-z0-9_]+$/);
    expect(new Set(SHOP_PRODUCT_IDS).size).toBe(SHOP_PRODUCT_IDS.length);
    expect(SHOP_ITEMS.every((i) => i.kind === 'skin' || i.kind === 'pack')).toBe(true);
  });

  it('every skin sold can be painted, classic is free', () => {
    for (const item of SHOP_ITEMS)
      if (item.kind === 'skin') expect(SKIN_PAINT[item.skin].body).toBeTruthy();
    expect(SKIN_PAINT.classic.body).toBeNull();
    expect(isPlateSkin('gold')).toBe(true);
    expect(isPlateSkin('neon')).toBe(false);
    expect(PLATE_SKINS[0]).toBe('classic');
  });

  it('each pack brings at least 10 lines that respect the rule', () => {
    const banned = /\b(gros|grosse|gras|poids|ventre|bide|moche|nul|nulle|bouboule)\b/i;
    for (const item of SHOP_ITEMS) {
      if (item.kind !== 'pack') continue;
      const lines = SKIP_LINES.filter((l) => l.pack === item.pack);
      expect(lines.length).toBeGreaterThanOrEqual(10);
      for (const l of lines) expect(l.text).not.toMatch(banned);
      expect(packSamples(item.pack)[0]).not.toContain('{pseudo}');
    }
  });
});
