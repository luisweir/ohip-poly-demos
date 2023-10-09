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
    }
};