// Runs before every test file (jest `setupFiles`), i.e. before src/config/env.ts is imported.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
// Placeholder only: tests connect to mongodb-memory-server explicitly.
process.env.MONGODB_URI = 'mongodb://placeholder.invalid/bookleaf-test';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
