/**
 * Shop catalog: one-time, cosmetic purchases only. Nothing here changes the game (no session,
 * no plate, no joker, no SKIP dodge). Prices come from the store (RevenueCat); product ids
 * must match App Store Connect and the server check (noskip.shop.skin.* / pack.* / poster.*).
 */
import { JOKE_PACKS, type JokePack, SKIP_LINES } from '../../content/skip-lines';

export const PLATE_SKINS = ['classic', 'gold', 'carbon', 'chrome'] as const;
export type PlateSkin = (typeof PLATE_SKINS)[number];

/** How a skin paints a plate: body colour and the thin rim drawn on its edges. */
export type SkinPaint = { body: string | null; rim: string | null; stripe: string | null };

/** `body: null` keeps the player's own colour (grey for teammates, orange for you). */
export const SKIN_PAINT: Record<PlateSkin, SkinPaint> = {
  classic: { body: null, rim: null, stripe: null },
  gold: { body: '#D9A441', rim: '#F3D27A', stripe: null },
  carbon: { body: '#26272B', rim: '#FF6A3D', stripe: '#3A3B40' },
  // Orange rim: your plates stay recognisable next to your teammates' grey ones.
  chrome: { body: '#DDE1E6', rim: '#FF6A3D', stripe: '#8E949C' },
};

/** SKIP poster styles: a buyer who equips one imposes it on their teammates' SKIP cards. */
export const POSTER_STYLES = ['classic', 'gold', 'redcard', 'gameover', 'wanted', 'news'] as const;
export type PosterStyle = (typeof POSTER_STYLES)[number];
export const POSTER_BUNDLE_ID = 'noskip.shop.poster.all';

export type ShopItem =
  | {
      kind: 'skin';
      productId: string;
      skin: Exclude<PlateSkin, 'classic'>;
      title: string;
      pitch: string;
    }
  | { kind: 'pack'; productId: string; pack: JokePack; title: string; pitch: string }
  | {
      kind: 'poster';
      productId: string;
      style: Exclude<PosterStyle, 'classic'>;
      title: string;
      pitch: string;
    }
  | { kind: 'posterBundle'; productId: string; title: string; pitch: string };

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    kind: 'poster',
    productId: 'noskip.shop.poster.gold',
    style: 'gold',
    title: 'Édition Or',
    pitch: 'Le skip de ton pote, en lettres d’or. Le luxe de l’humiliation.',
  },
  {
    kind: 'poster',
    productId: 'noskip.shop.poster.redcard',
    style: 'redcard',
    title: 'Carton Rouge',
    pitch: 'Expulsé par le Canap’. Le carton se lève devant toute la team.',
  },
  {
    kind: 'poster',
    productId: 'noskip.shop.poster.gameover',
    style: 'gameover',
    title: 'Game Over',
    pitch: 'Le Canap’ en boss final. Ton pote a perdu toutes ses vies.',
  },
  {
    kind: 'poster',
    productId: 'noskip.shop.poster.wanted',
    style: 'wanted',
    title: 'Avis de recherche',
    pitch: 'Recherché pour séance manquée. Récompense : une séance.',
  },
  {
    kind: 'poster',
    productId: 'noskip.shop.poster.news',
    style: 'news',
    title: 'Alerte Info',
    pitch: 'Flash spécial en direct : ton pote sèche la salle.',
  },
  {
    kind: 'posterBundle',
    productId: POSTER_BUNDLE_ID,
    title: 'Les 5 cartes',
    pitch: 'Tous les styles d’un coup. Change de carte quand tu veux.',
  },
  {
    kind: 'skin',
    productId: 'noskip.shop.skin.gold',
    skin: 'gold',
    title: 'Disques Or',
    pitch: 'Tes disques en or sur la barre de la team. Tes potes les verront.',
  },
  {
    kind: 'skin',
    productId: 'noskip.shop.skin.carbon',
    skin: 'carbon',
    title: 'Disques Carbone',
    pitch: 'Noir mat, liseré orange. Discret, sauf pour le Canap’.',
  },
  {
    kind: 'skin',
    productId: 'noskip.shop.skin.chrome',
    skin: 'chrome',
    title: 'Disques Chrome',
    pitch: 'Ça brille sous les néons de la salle. Et sur la barre.',
  },
  {
    kind: 'pack',
    productId: 'noskip.shop.pack.foot',
    pack: 'foot',
    title: 'Pack vannes Foot',
    pitch: '10 vannes du Canap’ en plus sur les cartes SKIP de ta team.',
  },
  {
    kind: 'pack',
    productId: 'noskip.shop.pack.gaming',
    pack: 'gaming',
    title: 'Pack vannes Gaming',
    pitch: '10 vannes du Canap’ en plus sur les cartes SKIP de ta team.',
  },
];

export const SHOP_PRODUCT_IDS = SHOP_ITEMS.map((i) => i.productId);

export function isPosterStyle(value: unknown): value is PosterStyle {
  return typeof value === 'string' && (POSTER_STYLES as readonly string[]).includes(value);
}

/** A style is mine if I bought it, or the pack of five (classic is free). */
export function ownsPosterStyle(owned: ReadonlySet<string>, style: PosterStyle): boolean {
  return (
    style === 'classic' || owned.has(`noskip.shop.poster.${style}`) || owned.has(POSTER_BUNDLE_ID)
  );
}

export function isPlateSkin(value: unknown): value is PlateSkin {
  return typeof value === 'string' && (PLATE_SKINS as readonly string[]).includes(value);
}

/** Two sample lines of a pack, for the shop card (with a placeholder name). */
export function packSamples(pack: JokePack, pseudo = 'Karim', count = 2): string[] {
  return SKIP_LINES.filter((l) => l.pack === pack)
    .slice(0, count)
    .map((l) => l.text.replaceAll('{pseudo}', pseudo));
}

export const ALL_PACKS = JOKE_PACKS;
