/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.(ts|tsx)"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@testing-library/.*|test-renderer|react-native-svg|react-native-gifted-charts|react-native-markdown-display)",
  ],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/__tests__/**", "!src/types/**", "!src/test/**"],
  clearMocks: true,
};
