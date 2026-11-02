import {
  hookVerdict,
  nextOnboardingRoute,
  ONBOARDING_TOTAL,
  onboardingStepNumber,
  type OnboardingState,
} from './onboarding';

const fresh: OnboardingState = {
  hookAnswered: false,
  signedIn: false,
  hasPrimaryGym: false,
  goalConfirmed: false,
  hasPseudo: false,
  teamCount: 0,
  locationAsked: false,
  rulesAccepted: false,
  notificationsAsked: false,
  hasPro: false,
};

describe('nextOnboardingRoute', () => {
  it('walks the 10 steps in order', () => {
    const order: (keyof OnboardingState)[] = [
      'hookAnswered',
      'signedIn',
      'hasPrimaryGym',
      'goalConfirmed',
      'hasPseudo',
      'teamCount',
      'locationAsked',
      'rulesAccepted',
      'notificationsAsked',
      'hasPro',
    ];
    const expected = [
      '/hook',
      '/sign-in',
      '/gym',
      '/goal',
      '/lifter-card',
      '/team-setup',
      '/location',
      '/rules',
      '/notifications',
      '/paywall',
    ];
    let state: OnboardingState = { ...fresh };
    order.forEach((key, i) => {
      expect(nextOnboardingRoute(state)).toBe(expected[i]);
      state = { ...state, [key]: key === 'teamCount' ? 1 : true };
    });
    expect(nextOnboardingRoute(state)).toBeNull();
    expect(ONBOARDING_TOTAL).toBe(10);
  });

  it('skips the hook for a player already signed in', () => {
    expect(nextOnboardingRoute({ ...fresh, signedIn: true })).toBe('/gym');
  });

  it('sends a player without Pro back to the paywall, data kept', () => {
    const done: OnboardingState = {
      ...fresh,
      hookAnswered: true,
      signedIn: true,
      hasPrimaryGym: true,
      goalConfirmed: true,
      hasPseudo: true,
      teamCount: 2,
      locationAsked: true,
      rulesAccepted: true,
      notificationsAsked: true,
    };
    expect(nextOnboardingRoute(done)).toBe('/paywall');
  });

  it('numbers steps for the progress bar', () => {
    expect(onboardingStepNumber('/hook')).toBe(1);
    expect(onboardingStepNumber('/paywall')).toBe(10);
  });
});

describe('hookVerdict', () => {
  it('reacts to the gap between planned and done', () => {
    expect(hookVerdict({ planned: 12, done: 5 })).toBe(
      "7 séances offertes au Canap'. Ça s'arrête là.",
    );
    expect(hookVerdict({ planned: 3, done: 2 })).toBe(
      "1 séance offerte au Canap'. Ça s'arrête là.",
    );
    expect(hookVerdict({ planned: 8, done: 9 })).toMatch(/^Propre/);
    expect(hookVerdict({ planned: 0, done: 0 })).toMatch(/^Zéro/);
  });
});
