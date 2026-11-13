import {
  crewLine,
  ctaLabel,
  formatPrice,
  periodSuffix,
  perWeekLabel,
  planForProduct,
  renewalNotice,
  trialDays,
  trialLabel,
} from './paywall';

describe('paywall wording', () => {
  it('maps products to plans like the webhook', () => {
    expect(planForProduct('noskip.pro.annual')).toBe('individual');
    expect(planForProduct('noskip.pro.weekly')).toBe('individual');
    expect(planForProduct('noskip.duo.annual')).toBe('duo');
    expect(planForProduct('NOSKIP_TEAM_ANNUAL')).toBe('team');
  });

  it('trial length from iOS intro prices or Android free phases', () => {
    expect(trialDays({ unit: 'DAY', count: 7 })).toBe(7);
    expect(trialDays({ unit: 'WEEK', count: 1 })).toBe(7);
    expect(trialDays({ unit: 'day', count: 3 })).toBe(3);
    expect(trialDays({ unit: 'MONTH', count: 1 })).toBe(30);
    expect(trialDays({ unit: 'DAY', count: 0 })).toBeNull();
    expect(trialDays({ unit: 'FORTNIGHT', count: 1 })).toBeNull();
    expect(trialDays(null)).toBeNull();
  });

  it('trial labels', () => {
    expect(trialLabel(7)).toBe('7 jours gratuits');
    expect(trialLabel(1)).toBe('1 jour gratuit');
    expect(trialLabel(30)).toBe('1 mois gratuit');
    expect(trialLabel(60)).toBe('2 mois gratuits');
    expect(trialLabel(null)).toBeNull();
  });

  it('periods and prices in French', () => {
    expect(periodSuffix('P1Y')).toBe('/an');
    expect(periodSuffix('P1W')).toBe('/semaine');
    expect(periodSuffix('P1M')).toBe('/mois');
    expect(periodSuffix('P3M')).toBe('/trimestre');
    expect(periodSuffix('P6M')).toBe('/semestre');
    expect(periodSuffix(null)).toBe('');
    expect(formatPrice(59.99, 'EUR')).toBe('59,99 €');
    expect(perWeekLabel(59.99, 'EUR')).toBe('Soit 1,15 € par semaine');
  });

  it('call to action', () => {
    expect(ctaLabel(7)).toBe("COMMENCER L'ESSAI GRATUIT");
    expect(ctaLabel(null)).toBe("C'EST PARTI");
  });

  it('store renewal disclosure', () => {
    expect(
      renewalNotice({ priceString: '59,99 €', period: 'P1Y', trialDays: 7, platform: 'ios' }),
    ).toBe(
      '7 jours gratuits, puis 59,99 €/an. Renouvellement automatique, résiliable à tout moment dans les réglages de ton compte App Store, au plus tard 24 h avant la fin de la période en cours.',
    );
    expect(
      renewalNotice({ priceString: '4,99 €', period: 'P1W', trialDays: null, platform: 'android' }),
    ).toMatch(/^4,99 €\/semaine\. Renouvellement automatique.*Google Play/);
  });
});

describe('crewLine', () => {
  it('invites to bring friends when the team is empty', () => {
    expect(crewLine([])).toMatch(/jusqu’à 3 potes.*gratuitement/);
  });

  it('names up to 3 teammates', () => {
    expect(crewLine(['Karim'])).toBe('Ton abonnement couvre aussi Karim : ça ne lui coûte rien.');
    expect(crewLine(['Karim', 'Sofiane', 'Léa', 'Max'])).toBe(
      'Ton abonnement couvre aussi Karim, Sofiane et Léa : ça ne leur coûte rien.',
    );
  });
});
