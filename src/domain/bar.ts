/** The team barbell: one plate per validated session of the week (20 kg). Pure. */
import type { PlateSkin } from './shop';
import type { WeekRisk } from './week';

export const KG_PER_SESSION = 20;
export const PERSONAL_BAR_BASE_KG = 20;
export const PERSONAL_KG_PER_SESSION = 2.5;

export type BarPlayer = {
  id: string;
  pseudo: string;
  color: string;
  isMe: boolean;
  goal: number;
  done: number;
  status: 'done' | 'at_gym' | 'not_yet';
  joker: boolean;
  /** Cosmetic plate skin bought in the shop (absent = classic). */
  skin?: PlateSkin;
};

export type Plate = {
  key: string;
  playerId: string;
  color: string;
  isMe: boolean;
  skin?: PlateSkin;
};

/**
 * Plates mounted on ONE sleeve, from the collar outwards (both sleeves are mirrored, as on a
 * real bar each 20 kg is two 10 kg plates). Order: teammates first (closest to the collar),
 * then "you" in orange, so your own plates are always visible on the outside.
 */
export function platesFor(players: BarPlayer[], accent: string): Plate[] {
  const others = players.filter((p) => !p.isMe);
  const me = players.filter((p) => p.isMe);
  return [...others, ...me].flatMap((p) =>
    Array.from({ length: p.done }, (_, i) => ({
      key: `${p.id}-${i}`,
      playerId: p.id,
      color: p.isMe ? accent : p.color,
      isMe: p.isMe,
      ...(p.skin && p.skin !== 'classic' ? { skin: p.skin } : {}),
    })),
  );
}

export function teamKg(players: BarPlayer[]): number {
  return players.reduce((sum, p) => sum + p.done, 0) * KG_PER_SESSION;
}

/** Plate thickness so the sleeve fits; 13 units on a 350-wide bar like the mockup, thinner when crowded. */
export function plateWidth(count: number, sleeveWidth: number, gap = 3, max = 13, min = 4): number {
  if (count === 0) return max;
  return Math.max(min, Math.min(max, (sleeveWidth - gap * (count - 1)) / count));
}

/** Everyone reached their goal this week: the team lifts the bar. */
export function allAchieved(players: BarPlayer[]): boolean {
  return players.length > 0 && players.every((p) => p.done >= p.goal);
}

export function statusLabel(status: BarPlayer['status']): string {
  return { done: 'Fait', at_gym: 'À la salle', not_yet: 'Pas encore' }[status];
}

/** Can I spot this player now? (Server enforces the limits again.) */
export function canSpot(target: BarPlayer, risk: WeekRisk): boolean {
  return !target.isMe && target.status !== 'done' && !target.joker && risk !== 'achieved';
}

/** "160 kg" with French thousands separator. */
export function formatKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  const [int, dec] = String(rounded).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec ? `${grouped},${dec}` : grouped;
}

/** Personal bar: 20 kg empty bar + 2.5 kg per validated session, for life. */
export function personalBarKg(lifetimeSessions: number): number {
  return PERSONAL_BAR_BASE_KG + PERSONAL_KG_PER_SESSION * lifetimeSessions;
}

/** "Ton 3e disque. Objectif de la semaine bouclé." */
export function plateLoadedLine(done: number, goal: number): string {
  const nth = done === 1 ? '1er' : `${done}e`;
  if (done >= goal) return `Ton ${nth} disque. Objectif de la semaine bouclé.`;
  const left = goal - done;
  return `Ton ${nth} disque. Encore ${left} pour boucler la semaine.`;
}
