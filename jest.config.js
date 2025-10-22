module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
      '^.+\\.tsx?$': 'ts-jest'
    },
    coverageThreshold: {
      global: {
        lines: 78
      }
    },
    coveragePathIgnorePatterns: [
      '<rootDir>/src/ai-gx/archive',
      '<rootDir>/src/ai-gx/tryFlow.ts',
      '<rootDir>/src/htng-ex/tryFlow.ts',
      '<rootDir>/src/logger.ts',
      '<rootDir>/src/pocs'
    ]
};