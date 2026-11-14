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
export const POSTER_STYLES = [
  'classic',
  'gold',
  'redcard',
  'gameover',
  'wanted',
  'news',
  'warrior',
  'magazine',
  'neon',
  'zen',
] as const;
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
    pitch: 'Carton rouge du Canap’. Il se lève devant toute la team.',
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
    pitch: 'Avis de recherche pour séance manquée. Récompense : une séance.',
  },
  {
    kind: 'poster',
    productId: 'noskip.shop.poster.news',
    style: 'news',
    title: 'Alerte Info',
    pitch: 'Flash spécial en direct : ton pote sèche la salle.',
  },
  {
    kind: 'poster',
    productId: 'noskip.shop.poster.warrior',
    style: 'warrior',
    title: 'Warrior',
    pitch: 'L’arène est prête. Ton pote déclare forfait.',
  },
  {
    kind: 'poster',
    productId: 'noskip.shop.poster.magazine',
    style: 'magazine',
    title: 'Couverture',
    pitch: 'En une du magazine : l’exclu du skip de la semaine.',
  },
  {
    kind: 'poster',
    productId: 'noskip.shop.poster.neon',
    style: 'neon',
    title: 'Néon',
    pitch: 'Néon rose dans la nuit : la salle est fermée, le Canap’ est ouvert.',
  },
  {
    kind: 'poster',
    productId: 'noskip.shop.poster.zen',
    style: 'zen',
    title: 'Zen',
    pitch: 'Inspire. Expire. Skip. La paix intérieure, sur le Canap’.',
  },
  {
    kind: 'posterBundle',
    productId: POSTER_BUNDLE_ID,
    title: 'Toutes les cartes',
    pitch: 'Toutes les cartes, et celles qui sortiront. Change de style quand tu veux.',
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
  {
    kind: 'pack',
    productId: 'noskip.shop.pack.braquage',
    pack: 'braquage',
    title: 'Pack vannes Braquage',
    pitch: 'Mission échouée, étoiles de recherche, planque au Canap’ : ambiance jeu de gangsters.',
  },
  {
    kind: 'pack',
    productId: 'noskip.shop.pack.telerealite',
    pack: 'telerealite',
    title: 'Pack vannes Téléréalité',
    pitch: 'Éliminé de la salle, confessionnal, la rose pour le Canap’.',
  },
  {
    kind: 'pack',
    productId: 'noskip.shop.pack.rap',
    pack: 'rap',
    title: 'Pack vannes Rap',
    pitch: 'Album « Zéro séance », feat avec le Canap’, clash de la salle.',
  },
  {
    kind: 'pack',
    productId: 'noskip.shop.pack.manga',
    pack: 'manga',
    title: 'Pack vannes Manga',
    pitch: 'Forme finale ratée, épisode de remplissage, sensei qui attend.',
  },
  {
    kind: 'pack',
    productId: 'noskip.shop.pack.daron',
    pack: 'daron',
    title: 'Pack vannes Daron',
    pitch: '« De mon temps, on allait à la salle à pied. » Les vannes de tes parents.',
  },
  {
    kind: 'pack',
    productId: 'noskip.shop.pack.horoscope',
    pack: 'horoscope',
    title: 'Pack vannes Horoscope',
    pitch: 'Mercure rétrograde, ascendant canapé : les astres l’avaient prédit.',
  },
];

/** Bump when items are added: the shop tab shows an orange dot until opened. */
export const SHOP_CATALOG_VERSION = 3;

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

/** Placeholder player on previews: no first name, so nobody is put off by one. */
export const SAMPLE_PSEUDO = 'Ton pote';

/** A real SKIP line with « ton pote » as the player (capitalised at the start). */
export function sampleLineText(text: string): string {
  const s = text.replaceAll('{pseudo}', 'ton pote');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A line by id, for previews. */
export function sampleSkipLine(id: string): string {
  return sampleLineText(SKIP_LINES.find((l) => l.id === id)?.text ?? SKIP_LINES[0].text);
}

/** Two sample lines of a pack, for the shop card. */
export function packSamples(pack: JokePack, count = 2): string[] {
  return SKIP_LINES.filter((l) => l.pack === pack)
    .slice(0, count)
    .map((l) => sampleLineText(l.text));
}

export const ALL_PACKS = JOKE_PACKS;
