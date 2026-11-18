// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ["node_modules/**", ".expo/**", "dist/**", "coverage/**", "mock-server/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx", "jest.setup.ts", "src/test/**/*.tsx"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);
