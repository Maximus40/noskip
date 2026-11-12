import { pickSdkKey, REVENUECAT_PUBLIC_DEFAULTS } from '../revenuecat';

jest.mock('react-native-purchases', () => ({}));

describe('pickSdkKey', () => {
  it('keeps a valid build key', () => {
    expect(pickSdkKey(' appl_Build123 ', 'appl_', 'appl_Default')).toBe('appl_Build123');
  });

  it('falls back on a missing, masked or wrong-store key', () => {
    expect(pickSdkKey(undefined, 'appl_', 'appl_Default')).toBe('appl_Default');
    expect(pickSdkKey('appl_Nc•••', 'appl_', 'appl_Default')).toBe('appl_Default');
    expect(pickSdkKey('goog_Abc', 'appl_', 'appl_Default')).toBe('appl_Default');
    expect(pickSdkKey('', 'goog_', null)).toBeNull();
  });

  it('ships the production iOS key', () => {
    expect(REVENUECAT_PUBLIC_DEFAULTS.ios).toMatch(/^appl_[A-Za-z0-9]+$/);
  });
});
