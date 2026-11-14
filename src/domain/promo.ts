/**
 * In-app offers: one card on Ma team, at most every few days, never pushy. Pure logic.
 * No prices in the copy: they come from the store and can change without an update.
 */
import { JOKE_PACKS } from '../../content/skip-lines';
import { PLATE_SKINS, POSTER_BUNDLE_ID, type PosterStyle } from './shop';

export type Promo = {
  id: 'posters' | 'bundle' | 'packs' | 'skins';
  eyebrow: string;
  title: string;
  body: string;
  /** Poster shown as a thumbnail on the card. */
  poster?: PosterStyle;
};

export const PROMOS: readonly Promo[] = [
  {
    id: 'posters',
    eyebrow: 'Nouveau',
    title: 'Impose ton style.',
    body: 'Équipe une carte SKIP premium : le prochain pote qui skip la reçoit.',
    poster: 'gameover',
  },
  {
    id: 'bundle',
    eyebrow: 'Meilleure affaire',
    title: 'Toutes les cartes d’un coup.',
    body: '9 cartes SKIP premium, et celles qui sortiront.',
    poster: 'neon',
  },
  {
    id: 'packs',
    eyebrow: 'Packs de vannes',
    title: 'Le Canap’ a de nouvelles vannes.',
    body: 'Braquage, Téléréalité, Rap, Manga… pour toute ta team.',
  },
  {
    id: 'skins',
    eyebrow: 'Skins',
    title: 'Des disques en or ?',
    body: 'Ta barre brille devant toute la team.',
  },
];

/** Days between two offer cards once the player has closed one. */
export const PROMO_GAP_DAYS = 3;

/** Already owns everything a promo sells: it is never shown. */
function ownsAll(promo: Promo, owned: ReadonlySet<string>): boolean {
  switch (promo.id) {
    case 'posters':
    case 'bundle':
      return owned.has(POSTER_BUNDLE_ID);
    case 'packs':
      return JOKE_PACKS.every((p) => owned.has(`noskip.shop.pack.${p}`));
    case 'skins':
      return PLATE_SKINS.filter((s) => s !== 'classic').every((s) =>
        owned.has(`noskip.shop.skin.${s}`),
      );
  }
}

/**
 * The offer to show now, or null: not before the tutorial is done, not within PROMO_GAP_DAYS of
 * the last one closed, never for what the player already owns. Rotates by day.
 */
export function promoToShow(
  now: number,
  opts: { tutorialSeen: boolean; dismissedAt: string | null; owned: ReadonlySet<string> },
): Promo | null {
  if (!opts.tutorialSeen) return null;
  if (opts.dismissedAt) {
    const since = now - Date.parse(opts.dismissedAt);
    if (Number.isFinite(since) && since < PROMO_GAP_DAYS * 86_400_000) return null;
  }
  const available = PROMOS.filter((p) => !ownsAll(p, opts.owned));
  if (available.length === 0) return null;
  const day = Math.floor(now / 86_400_000);
  return available[day % available.length];
}

/** The line under a SKIP card that leads to the shop. */
export function skipCardShopHint(isMine: boolean, style: PosterStyle): string {
  if (isMine) return 'La prochaine fois, c’est toi qui choisis la carte de tes potes.';
  if (style === 'classic') return 'Chambre-le avec une carte premium.';
  return 'Toi aussi, impose ton style au prochain skip.';
}
