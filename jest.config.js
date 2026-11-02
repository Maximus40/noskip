/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  resolver: 'react-native-reanimated/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/supabase/'],
  collectCoverageFrom: ['src/domain/**/*.ts', '!src/domain/**/*.test.ts'],
  coverageThreshold: {
    'src/domain/': { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
