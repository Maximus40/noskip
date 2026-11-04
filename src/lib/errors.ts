/** Stable error codes (raised by RPCs / Edge Functions) → French, tutoiement. */
const MESSAGES: Record<string, string> = {
  not_authenticated: 'Ta session a expiré. Reconnecte-toi.',
  invalid_goal: 'Choisis entre 2 et 5 séances par semaine.',
  unknown_gym: "Cette salle n'existe pas dans notre base. Relance la recherche.",
  gym_not_chosen: "Cette salle n'est pas dans tes salles.",
  max_gyms_reached: "Tu as déjà 3 salles. Retire-en une d'abord.",
  primary_gym_change_too_soon:
    'Tu as déjà changé de salle principale ce mois-ci. Prochain changement possible dans 30 jours.',
  cannot_remove_primary_gym:
    'Impossible de retirer ta salle principale. Choisis-en une autre avant.',
  invalid_team_name: 'Le nom de la team doit faire entre 2 et 32 caractères.',
  max_teams_reached: "Tu es déjà dans 3 teams. C'est le max.",
  not_a_member: 'Tu ne fais pas partie de cette team.',
  not_team_owner: 'Seul le créateur de la team peut faire ça.',
  already_validated_today: "Séance déjà validée aujourd'hui. Reviens demain.",
  invalid_started_at: "L'heure d'arrivée ne colle pas. Réessaie depuis la salle.",
  gym_search_unavailable: 'La recherche de salles ne répond pas. Réessaie dans un instant.',
  invalid_input: 'Quelque chose cloche dans ta saisie.',
  invalid_email: "Cette adresse e-mail n'a pas l'air valide.",
  otp_expired: 'Code expiré ou incorrect. Demande-en un nouveau.',
  rate_limited: 'Doucement ! Attends un peu avant de réessayer.',
  network: 'Pas de réseau. Vérifie ta connexion et réessaie.',
  sign_in_cancelled: '',
  invalid_invite_code: "Ce code d'invitation ne marche pas. Vérifie-le ou demande un nouveau lien.",
  team_full: 'Cette team est complète (4 joueurs max, 8 avec l’offre Team).',
  owner_cannot_remove_self: 'Pour partir, utilise « Quitter la team ».',
  join_failed: "Impossible de rejoindre la team pour l'instant. Réessaie.",
};

export const GENERIC_ERROR = 'Oups, ça a coincé. Réessaie.';

type ErrorLike = { message?: unknown; code?: unknown; status?: unknown; name?: unknown };

/** Extracts a stable code from Supabase/PostgREST/Functions/Auth/network errors. */
export function errorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return typeof err === 'string' ? err : null;
  const e = err as ErrorLike;
  const message = typeof e.message === 'string' ? e.message : '';
  if (message in MESSAGES) return message;
  if (typeof e.code === 'string' && e.code in MESSAGES) return e.code;
  if (
    e.code === 'otp_expired' ||
    (e.name === 'AuthApiError' && /token has expired|invalid/i.test(message))
  ) {
    return 'otp_expired';
  }
  if (e.status === 429 || e.code === 'over_email_send_rate_limit') return 'rate_limited';
  if (e.code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(message))
    return 'invalid_email';
  if (/network request failed|failed to fetch|fetch failed/i.test(message)) return 'network';
  return null;
}

export function toUserMessage(err: unknown): string {
  const code = errorCode(err);
  return code !== null && code in MESSAGES ? MESSAGES[code] : GENERIC_ERROR;
}

/** Reads `{ error: code }` from an Edge Function error response. */
export async function functionErrorCode(err: unknown): Promise<string | null> {
  const ctx = (err as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: unknown };
      if (typeof body.error === 'string') return body.error;
    } catch {
      return null;
    }
  }
  return errorCode(err);
}
