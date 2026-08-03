// Run `npm install` in this directory before running tests.
// All test packages are pinned to exact versions in package.json devDependencies.
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/src/__tests__/__mocks__/styleMock.js",
    "\\.(jpg|jpeg|png|gif|svg|webp)$": "<rootDir>/src/__tests__/__mocks__/fileMock.js",
    "^react-i18next$": "<rootDir>/src/__tests__/__mocks__/react-i18next.js",
  },
  transform: {
    "^.+\\.(tsx|jsx)$": [
      "babel-jest",
      {
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          ["@babel/preset-react", { runtime: "automatic" }],
          "@babel/preset-typescript",
        ],
      },
    ],
    "^.+\\.(ts|js)$": [
      "babel-jest",
      {
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          "@babel/preset-typescript",
        ],
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/*.test.[jt]s?(x)"],
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/src/__tests__/__mocks__/",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/i18n/**",
    "!src/middleware.ts",
  ],
  coverageReporters: ["lcov", "text-summary"],
};
