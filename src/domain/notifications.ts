/**
 * Push notification preferences and where a tapped notification leads. Pure.
 * The `data.type` values are the ones the Edge Functions send.
 */

export type NotificationPrefKey =
  'plate_loaded' | 'spot' | 'shaky_bar' | 'skip' | 'recap' | 'team_pr' | 'gym_change' | 'offers';

/** Marketing pushes need an explicit opt-in (Apple 4.5.4): off until the player turns them on. */
const OFF_BY_DEFAULT: readonly NotificationPrefKey[] = ['offers'];

/** Every type a player can switch off (order = settings screen). */
export const NOTIFICATION_PREFS: readonly {
  key: NotificationPrefKey;
  label: string;
  detail: string;
}[] = [
  { key: 'plate_loaded', label: 'Disque chargé', detail: 'Quand un pote valide une séance.' },
  { key: 'spot', label: 'Spots', detail: 'Quand un pote te relance pour aller à la salle.' },
  {
    key: 'shaky_bar',
    label: 'Barre qui tremble',
    detail: 'Quand toi ou un pote risquez le skip, à 18 h.',
  },
  { key: 'skip', label: 'Cartes SKIP', detail: 'Le dimanche à 20 h, quand quelqu’un a skip.' },
  { key: 'team_pr', label: 'PR de la team', detail: 'Quand toute la team a tenu son objectif.' },
  {
    key: 'recap',
    label: 'Bilan et Ceinture',
    detail: 'Le bilan du dimanche à 20 h 05 et la Ceinture du mois.',
  },
  {
    key: 'gym_change',
    label: 'Changement de salle',
    detail: 'Quand un pote change de salle principale (jamais laquelle).',
  },
  {
    key: 'offers',
    label: 'Nouveautés et offres',
    detail:
      'Nouvelles cartes, packs et promos de la boutique. Désactivé tant que tu ne l’actives pas.',
  },
];

/**
 * Game notifications are on unless switched off; offers are off unless switched on (same rules
 * as the SQL: coalesce(..., true) for the game, coalesce(..., false) for offers).
 */
export function isPrefOn(prefs: unknown, key: NotificationPrefKey): boolean {
  const value =
    prefs && typeof prefs === 'object' ? (prefs as Record<string, unknown>)[key] : undefined;
  return OFF_BY_DEFAULT.includes(key) ? value === true : value !== false;
}

export function withPref(
  prefs: unknown,
  key: NotificationPrefKey,
  on: boolean,
): Record<string, unknown> {
  const base = prefs && typeof prefs === 'object' ? (prefs as Record<string, unknown>) : {};
  return { ...base, [key]: on };
}

export type NotificationRoute =
  | { pathname: '/skip/[id]'; params: { id: string } }
  | { pathname: '/recap/[weekId]'; params: { weekId: string } }
  | { pathname: '/lifter/[id]'; params: { id: string } }
  | { pathname: '/lifter' }
  | { pathname: '/team' }
  | { pathname: '/boutique' };

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/** Screen to open for a tapped notification (null: unknown payload, stay where we are). */
export function routeForNotification(
  data: unknown,
  myUserId: string | null,
): NotificationRoute | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  switch (d.type) {
    case 'skip': {
      const card = str(d.card_id);
      if (card) return { pathname: '/skip/[id]', params: { id: card } };
      const week = str(d.week_id);
      return week
        ? { pathname: '/recap/[weekId]', params: { weekId: week } }
        : { pathname: '/team' };
    }
    case 'recap':
    case 'team_pr': {
      const week = str(d.week_id);
      return week
        ? { pathname: '/recap/[weekId]', params: { weekId: week } }
        : { pathname: '/team' };
    }
    case 'belt': {
      const user = str(d.user_id);
      if (!user || user === myUserId) return { pathname: '/lifter' };
      return { pathname: '/lifter/[id]', params: { id: user } };
    }
    case 'plate_loaded':
    case 'spot':
    case 'shaky':
    case 'shaky_self':
    case 'gym_change':
      return { pathname: '/team' };
    case 'offer':
      return { pathname: '/boutique' };
    default:
      return null;
  }
}
