/** Content of the welcome pages shown before the first onboarding question. Pure data. */
import type { BarPlayer } from './bar';

export type WelcomeSlide = {
  key: 'hero' | 'team' | 'plate' | 'skip';
  eyebrow: string;
  title: string;
  body: string;
};

export const WELCOME_SLIDES: readonly WelcomeSlide[] = [
  {
    key: 'hero',
    eyebrow: 'Bienvenue dans',
    title: 'NOXCUSE.',
    body: 'Le jeu qui t’envoie à la salle. Avec tes potes, sans excuse.',
  },
  {
    key: 'team',
    eyebrow: 'Ta team',
    title: 'TA TEAM. TA BARRE. ZÉRO EXCUSE.',
    body: 'Toi et 1 à 3 potes, une barre à charger chaque semaine. Seul, on lâche. En team, on se tient.',
  },
  {
    key: 'plate',
    eyebrow: 'Chaque séance',
    title: 'UNE SÉANCE = UN DISQUE.',
    body: '40 minutes à ta salle et ton téléphone te pointe tout seul : 20 kg de plus sur la barre de la team. Ta position ne quitte jamais ton téléphone.',
  },
  {
    key: 'skip',
    eyebrow: 'Dimanche 20 h',
    title: 'TU SKIP ? TOUTE LA TEAM LE SAURA.',
    body: "Objectif raté : le Canap' envoie ta carte SKIP à toute la team. Tes potes peuvent te spotter avant. À toi de voir.",
  },
];

/** Sample team for the animations (never sent anywhere). */
export const WELCOME_DEMO_TEAM: { name: string; players: BarPlayer[] } = {
  name: 'Les Déchaînés',
  players: [
    {
      id: 'alex',
      pseudo: 'Alex',
      color: '#B9BBC0',
      isMe: false,
      goal: 3,
      done: 2,
      status: 'done',
      joker: false,
    },
    {
      id: 'sam',
      pseudo: 'Sam',
      color: '#7C7E84',
      isMe: false,
      goal: 3,
      done: 1,
      status: 'not_yet',
      joker: false,
    },
    {
      id: 'me',
      pseudo: 'Toi',
      color: '#F5F5F0',
      isMe: true,
      goal: 3,
      done: 2,
      status: 'done',
      joker: false,
    },
  ],
};
