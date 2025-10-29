module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
      '^.+\\.tsx?$': 'ts-jest'
    },
    coverageThreshold: {
      global: {
        lines: 90
      }
    },
    coveragePathIgnorePatterns: [
      '<rootDir>/src/ai-gx/archive',
      '<rootDir>/src/ai-gx/tryFlow.ts',
      '<rootDir>/src/htng-ex',
      '<rootDir>/src/logger.ts',
      '<rootDir>/src/pocs'
    ]
};
