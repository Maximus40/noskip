import { loadPlans } from '../revenuecat';

const pkg = (packageType: string, identifier: string, price: number) => ({
  packageType,
  product: {
    identifier,
    price,
    priceString: `${price} €`,
    currencyCode: 'EUR',
    subscriptionPeriod: packageType === 'WEEKLY' ? 'P1W' : 'P1Y',
    introPrice: null,
    defaultOption: null,
  },
});

const mockOfferings = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(async () => ({})),
    getAppUserID: jest.fn(async () => 'u1'),
    getOfferings: () => mockOfferings(),
    setLogLevel: jest.fn(),
  },
  LOG_LEVEL: { WARN: 'WARN', ERROR: 'ERROR' },
}));

describe('loadPlans', () => {
  it('reads annual + weekly from the current offering and Team from "friends"', async () => {
    mockOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          pkg('WEEKLY', 'noskip.pro.weekly', 4.99),
          pkg('ANNUAL', 'noskip.pro.annual', 59.99),
        ],
      },
      all: { friends: { availablePackages: [pkg('CUSTOM', 'noskip.team.annual', 149.99)] } },
    });
    const plans = await loadPlans('u1');
    expect(plans.solo.map((o) => [o.key, o.price])).toEqual([
      ['annual', 59.99],
      ['weekly', 4.99],
    ]);
    expect(plans.friends.map((o) => [o.key, o.price])).toEqual([['team', 149.99]]);
  });

  it('never shows a Team product as "Annuel", even if misplaced in the current offering', async () => {
    mockOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          pkg('ANNUAL', 'noskip.team.annual', 149.99),
          pkg('WEEKLY', 'noskip.pro.weekly', 4.99),
        ],
      },
      all: {},
    });
    const plans = await loadPlans('u1');
    expect(plans.solo.map((o) => o.key)).toEqual(['weekly']);
  });
});
