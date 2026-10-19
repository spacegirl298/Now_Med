// Only the Firestore rules tests; they need the emulator, so run them with
// `npm run test:rules` rather than calling vitest directly.
export default {
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    testTimeout: 20000,
  },
}
