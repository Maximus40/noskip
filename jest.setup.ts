/* Global test setup. */
import { setUpTests } from 'react-native-reanimated';

setUpTests();

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// RevenueCat is a native module: tests never reach the stores.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    getOfferings: jest.fn(),
    getCustomerInfo: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    setAttributes: jest.fn(),
    showManageSubscriptions: jest.fn(),
  },
}));
