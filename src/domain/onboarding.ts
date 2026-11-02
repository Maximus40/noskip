/** Onboarding funnel (≤ 60 s): which screen a player must see next. Pure, no I/O. */

export type OnboardingRoute =
  | '/hook'
  | '/sign-in'
  | '/gym'
  | '/goal'
  | '/lifter-card'
  | '/team-setup'
  | '/location'
  | '/rules'
  | '/notifications'
  | '/paywall';

export type OnboardingState = {
  hookAnswered: boolean;
  signedIn: boolean;
  hasPrimaryGym: boolean;
  goalConfirmed: boolean;
  hasPseudo: boolean;
  teamCount: number;
  locationAsked: boolean;
  rulesAccepted: boolean;
  notificationsAsked: boolean;
  hasPro: boolean;
};

export const ONBOARDING_STEPS: readonly {
  route: OnboardingRoute;
  done: (s: OnboardingState) => boolean;
}[] = [
  { route: '/hook', done: (s) => s.hookAnswered },
  { route: '/sign-in', done: (s) => s.signedIn },
  { route: '/gym', done: (s) => s.hasPrimaryGym },
  { route: '/goal', done: (s) => s.goalConfirmed },
  { route: '/lifter-card', done: (s) => s.hasPseudo },
  { route: '/team-setup', done: (s) => s.teamCount > 0 },
  { route: '/location', done: (s) => s.locationAsked },
  { route: '/rules', done: (s) => s.rulesAccepted },
  { route: '/notifications', done: (s) => s.notificationsAsked },
  { route: '/paywall', done: (s) => s.hasPro },
];

export const ONBOARDING_TOTAL = ONBOARDING_STEPS.length;

/** First unfinished step, or null when the player can enter the app. */
export function nextOnboardingRoute(state: OnboardingState): OnboardingRoute | null {
  // A returning player who signed in on a new phone skips the hook.
  if (state.signedIn && !state.hookAnswered) {
    return nextOnboardingRoute({ ...state, hookAnswered: true });
  }
  return ONBOARDING_STEPS.find((step) => !step.done(state))?.route ?? null;
}

/** 1-based position of a step, for the progress bar. */
export function onboardingStepNumber(route: OnboardingRoute): number {
  return ONBOARDING_STEPS.findIndex((s) => s.route === route) + 1;
}

export type HookAnswers = { planned: number; done: number };

/** Punchline of the hook screen. */
export function hookVerdict({ planned, done }: HookAnswers): string {
  if (planned === 0) return "Zéro de prévu. Le Canap' n'a même pas eu à se battre.";
  if (done >= planned) return 'Propre. Maintenant on tient ça toute l’année.';
  const missed = planned - done;
  return `${missed} séance${missed > 1 ? 's' : ''} offerte${missed > 1 ? 's' : ''} au Canap'. Ça s'arrête là.`;
}
