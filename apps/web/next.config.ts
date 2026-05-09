import type { NextConfig } from 'next';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Produce a self-contained Node bundle under `.next/standalone` so the
  // production Docker image can ship without `node_modules` + the full
  // Next install. Without this flag the standalone server entrypoint
  // (`apps/web/server.js`) doesn't exist and the runtime image can't boot.
  output: 'standalone',
  // In a turborepo monorepo Next can't see `package.json`s outside the
  // app directory by default — point it at the repo root so the
  // standalone bundle includes hoisted workspace deps.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@gsm/shared-types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'evwsports.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.unsplash.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
