import base from '../../packages/config/eslint.base.mjs';

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  global: 'readonly',
  module: 'readonly',
  require: 'readonly',
  exports: 'writable',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
  Express: 'readonly',
  NodeJS: 'readonly',
  // Node 18+ / undici globals used by TelegramService (plain HTTP client).
  fetch: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  Headers: 'readonly',
  RequestInit: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
};

const testGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  vi: 'readonly',
};

export default [
  ...base,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: { ...nodeGlobals },
    },
  },
  {
    files: ['src/**/*.spec.ts', 'src/**/*.e2e-spec.ts', 'test/**/*.ts'],
    languageOptions: {
      globals: { ...nodeGlobals, ...testGlobals },
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.turbo/', 'coverage/'],
  },
];
