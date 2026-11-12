import { Linking } from 'react-native';

import { manageSubscription, STORE_SUBSCRIPTIONS_URL } from '../revenuecat';

const mockShow = jest.fn();
const mockConfigure = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Linking: { openURL: jest.fn(async () => true) },
}));
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: (...a: unknown[]) => mockConfigure(...a),
    logIn: jest.fn(async () => ({})),
    showManageSubscriptions: () => mockShow(),
  },
}));

describe('manageSubscription', () => {
  beforeEach(() => {
    mockShow.mockReset();
    mockConfigure.mockReset();
    (Linking.openURL as jest.Mock).mockClear();
  });

  it('configures RevenueCat for the player before opening the store sheet', async () => {
    mockShow.mockResolvedValue(undefined);
    await manageSubscription('u1');
    expect(mockConfigure).toHaveBeenCalledWith(expect.objectContaining({ appUserID: 'u1' }));
    expect(mockShow).toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('falls back to the App Store subscriptions page when the sheet fails', async () => {
    mockShow.mockRejectedValue(new Error('no sheet'));
    await manageSubscription('u1');
    expect(Linking.openURL).toHaveBeenCalledWith(STORE_SUBSCRIPTIONS_URL.ios);
  });
});
