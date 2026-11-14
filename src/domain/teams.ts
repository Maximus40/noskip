/** Team rules shared by screens. Mirrors the SQL limits (see migrations …000200 / …000600). */
import { APP_NAME, APP_SCHEME } from '../../content/brand';
import { SITE_PAGES } from '../../content/publisher';

export const INVITE_CODE_LENGTH = 8;
export const STANDARD_TEAM_CAPACITY = 4;
export const TEAM_PLAN_CAPACITY = 8;
export const MAX_TEAMS_PER_PLAYER = 3;

const ALPHABET = /^[A-HJ-NP-Z2-9]+$/;

/** "abcd-2345" → "ABCD2345"; null if it cannot be a valid code. */
export function normalizeInviteCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === INVITE_CODE_LENGTH && ALPHABET.test(code) ? code : null;
}

/**
 * Pulls a code out of anything pasted: a bare code, noxcuse://join/X, https://host/join/X, the
 * web invite page (…/rejoindre/?code=X) or a whole invite message.
 */
export function extractInviteCode(input: string): string | null {
  const fromLink = /(?:join\/|code=|Code : )([A-Za-z0-9-]{8,9})/.exec(input);
  return normalizeInviteCode(fromLink ? fromLink[1] : input.trim());
}

/** "ABCD2345" → "ABCD-2345" (easier to read out loud). */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Link shared in invites: a universal link when a domain is configured, otherwise the public web
 * page (always tappable in messaging apps, explains how to install the app and join).
 */
export function inviteUrl(code: string, host?: string | null): string {
  return host ? `https://${host}/join/${code}` : `${SITE_PAGES.join}?code=${code}`;
}

/** Opens the invite straight in the app (only works once it is installed). */
export function inviteAppUrl(code: string): string {
  return `${APP_SCHEME}://join/${code}`;
}

/** Bottom line of the SKIP poster: a readable link when a domain exists, the code otherwise. */
export function posterInviteLabel(code: string, host?: string | null): string {
  return host
    ? `Rejoins la team → ${host}/join/${code}`
    : `Rejoins la team sur ${APP_NAME} · code ${formatInviteCode(code)}`;
}

export function inviteMessage(teamName: string, code: string, host?: string | null): string {
  return (
    `Rejoins « ${teamName} » sur ${APP_NAME}. Chaque séance charge la barre de la team, ` +
    `chaque skip finit en carte pour le Canap'.\n${inviteUrl(code, host)}\n` +
    `Code : ${formatInviteCode(code)}\nPas encore l'app ? Le lien t'explique tout.`
  );
}

export function validateTeamName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 2) return 'Au moins 2 caractères.';
  if (trimmed.length > 32) return '32 caractères max.';
  return null;
}

/** "2 / 4 joueurs" and whether someone can still join. */
export function teamFill(memberCount: number, capacity: number): { label: string; full: boolean } {
  return { label: `${memberCount} / ${capacity} joueurs`, full: memberCount >= capacity };
}

/** Short French list: "Sofiane", "Sofiane et Karim", "Sofiane, Karim et 2 autres". */
export function pseudoList(pseudos: string[]): string {
  if (pseudos.length === 0) return 'personne pour l’instant';
  if (pseudos.length === 1) return pseudos[0];
  if (pseudos.length === 2) return `${pseudos[0]} et ${pseudos[1]}`;
  const rest = pseudos.length - 2;
  return `${pseudos[0]}, ${pseudos[1]} et ${rest} autre${rest > 1 ? 's' : ''}`;
}
