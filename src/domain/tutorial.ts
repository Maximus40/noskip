/** Coach marks shown on the first visit of Ma team. Pure data. */

export type CoachTargetId = 'bar' | 'players' | 'session' | 'history';

export type CoachStep = { target: CoachTargetId; eyebrow: string; title: string; body: string };

export const TEAM_TUTORIAL: readonly CoachStep[] = [
  {
    target: 'bar',
    eyebrow: '1 · La barre',
    title: 'Ta barre de team.',
    body: 'Chaque séance validée y charge 20 kg. Tes disques sont en orange, ceux de tes potes en gris.',
  },
  {
    target: 'players',
    eyebrow: '2 · Tes potes',
    title: 'Qui a fait sa séance ?',
    body: '« Fait », « À la salle » ou « Pas encore ». Touche Spot pour relancer celui qui traîne (3 par jour).',
  },
  {
    target: 'session',
    eyebrow: '3 · Ta séance',
    title: 'Tu n’as rien à faire.',
    body: 'Reste 40 min à ta salle : ton téléphone te pointe tout seul. Ce bouton, c’est le plan B « Je suis à la salle ».',
  },
  {
    target: 'history',
    eyebrow: '4 · Le dimanche',
    title: 'Bilan à 20 h.',
    body: 'Kilos de la semaine, Machine, Skippeur et cartes SKIP. Toutes les semaines passées sont ici.',
  },
];

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Where the bubble goes: under the highlighted element when there is room, otherwise above it.
 * Returns the bubble's top edge and the side its arrow points to.
 */
export function bubblePlacement(
  target: Rect | null,
  screenHeight: number,
  bubbleHeight: number,
  margin = 14,
): { top: number; arrow: 'up' | 'down' | 'none' } {
  if (!target) return { top: Math.max(0, (screenHeight - bubbleHeight) / 2), arrow: 'none' };
  const below = target.y + target.height + margin;
  if (below + bubbleHeight <= screenHeight - margin) return { top: below, arrow: 'up' };
  return { top: Math.max(margin, target.y - margin - bubbleHeight), arrow: 'down' };
}
