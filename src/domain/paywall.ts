/**
 * Paywall wording from store data (prices and trials come from RevenueCat offerings, so they
 * can change without an app update). Pure.
 */

export type PaidPlan = 'individual' | 'duo' | 'team';

/** Product ids carry the plan: noskip.pro.*, noskip.duo.*, noskip.team.* (same rule as the webhook). */
export function planForProduct(productId: string): PaidPlan {
  const id = productId.toLowerCase();
  if (id.includes('team')) return 'team';
  if (id.includes('duo')) return 'duo';
  return 'individual';
}

export type TrialPeriod = { unit: string; count: number } | null | undefined;

const DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

/** Free trial length in days (iOS intro price or Android free phase), null without trial. */
export function trialDays(trial: TrialPeriod): number | null {
  if (!trial || trial.count <= 0) return null;
  const perUnit = DAYS[trial.unit.toUpperCase()];
  return perUnit ? perUnit * trial.count : null;
}

export function trialLabel(days: number | null): string | null {
  if (!days) return null;
  if (days % 30 === 0) {
    const months = days / 30;
    return `${months} mois gratuit${months > 1 ? 's' : ''}`;
  }
  return `${days} jour${days > 1 ? 's' : ''} gratuit${days > 1 ? 's' : ''}`;
}

/** "/an", "/semaine", "/mois" from an ISO 8601 period (P1Y, P1W, P1M, P3M…). */
export function periodSuffix(iso: string | null | undefined): string {
  switch (iso) {
    case 'P1Y':
    case 'P12M':
      return '/an';
    case 'P1W':
    case 'P7D':
      return '/semaine';
    case 'P1M':
      return '/mois';
    case 'P3M':
      return '/trimestre';
    case 'P6M':
      return '/semestre';
    default:
      return '';
  }
}

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency })
    .format(amount)
    .replace(/ | /g, ' ');
}

/** "Soit 1,15 € par semaine" for a yearly price. */
export function perWeekLabel(yearlyPrice: number, currency: string): string {
  return `Soit ${formatPrice(Math.floor((yearlyPrice / 52) * 100) / 100, currency)} par semaine`;
}

export function ctaLabel(days: number | null): string {
  return days ? "COMMENCER L'ESSAI GRATUIT" : 'CHOISIR LES DIPS';
}

/** Auto-renewal disclosure required by the stores, under the buy button. */
export function renewalNotice(input: {
  priceString: string;
  period: string | null | undefined;
  trialDays: number | null;
  platform: 'ios' | 'android';
}): string {
  const store = input.platform === 'ios' ? 'App Store' : 'Google Play';
  const price = `${input.priceString}${periodSuffix(input.period)}`;
  const start = input.trialDays
    ? `${trialLabel(input.trialDays)
        ?.replace('gratuits', 'gratuits,')
        .replace(/gratuit$/, 'gratuit,')} puis ${price}.`
    : `${price}.`;
  return `${start.charAt(0).toUpperCase()}${start.slice(1)} Renouvellement automatique, résiliable à tout moment dans les réglages de ton compte ${store}, au plus tard 24 h avant la fin de la période en cours.`;
}

/** Who the personal plan covers, with the teammates' names when there are some. */
export function crewLine(names: string[]): string {
  if (!names.length) {
    return 'Ton abonnement couvre aussi jusqu’à 3 potes dans ta team. Invite-les : ils jouent gratuitement.';
  }
  const shown = names.slice(0, 3);
  const list =
    shown.length === 1
      ? shown[0]
      : `${shown.slice(0, -1).join(', ')} et ${shown[shown.length - 1]}`;
  return `Ton abonnement couvre aussi ${list} : ça ne ${shown.length === 1 ? 'lui' : 'leur'} coûte rien.`;
}
