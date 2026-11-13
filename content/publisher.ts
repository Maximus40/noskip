/**
 * Publisher identity for the legal pages (mentions légales, privacy, terms), shown in the app
 * and on the public site (docs/, served by GitHub Pages). Public information by law (LCEN):
 * it lives in code like the other public defaults; EXPO_PUBLIC_LEGAL_* can still override it.
 * A null field shows "[à compléter avant publication]": never invent these values.
 */
export type Publisher = {
  /** Legal name of the business, e.g. "Prénom Nom (EI)" or a trade name. */
  name: string | null;
  /** Registered address (the domiciliation address, never a private home address). */
  address: string | null;
  /** SIRET number (micro-entreprise). */
  siret: string | null;
  /** Contact address for users, privacy requests and the stores. */
  email: string | null;
};

export const PUBLISHER: Publisher = {
  name: 'PulseAi Agency',
  address: '60 rue François 1er, 75008 Paris, France',
  siret: '508 598 778 00035',
  email: null,
};

/** Public site with the legal pages and the support page (GitHub Pages of the repository). */
export const SITE_URL = 'https://maximus40.github.io/noskip';

export const SITE_PAGES = {
  support: `${SITE_URL}/`,
  privacy: `${SITE_URL}/confidentialite/`,
  terms: `${SITE_URL}/cgu/`,
  notice: `${SITE_URL}/mentions-legales/`,
} as const;
