// Load .env into process.env before any module is evaluated — AuthModule
// gates GoogleStrategy on process.env at decorator time, which runs during
// import resolution (before ConfigModule.forRoot()).
import 'dotenv/config';

// Sentry must be initialised BEFORE NestFactory.create — its node SDK
// monkey-patches `http`/`https` to capture outgoing requests and
// unhandled exceptions. Loading order matters.
import { initSentry } from './observability/sentry';
const sentryActive = initSentry();

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { join } from 'path';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { SportsService } from './sports/sports.service';
import { UsersService } from './users/users.service';
import { SentryExceptionFilter } from './observability/sentry-exception.filter';

/**
 * Build the CORS allow-list. Production-safe rules:
 *   - In `production`, only origins explicitly listed via `FRONTEND_URL`
 *     (comma-separated) are allowed — no localhost fallback.
 *   - In dev, the listed origins plus localhost ports 3000 / 3001 are
 *     allowed for hot-reload across web/api/ops.
 *
 * Misconfiguration (production with unset FRONTEND_URL) refuses every
 * cross-origin request rather than silently exposing the API to the
 * world via the dev fallback.
 */
function buildCorsOrigins(): string[] {
  const raw = process.env.FRONTEND_URL ?? '';
  const fromEnv = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production') return fromEnv;
  return [...new Set([...fromEnv, 'http://localhost:3000', 'http://localhost:3001'])];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.use(cookieParser());
  // Trust the first proxy hop so `req.ip` reflects the client (not the
  // load balancer) — required for ThrottlerGuard to bucket by client IP
  // when the API runs behind Railway / Render / Cloudflare.
  app.set('trust proxy', 1);

  // Replace Nest's default console logger with pino. `bufferLogs: true`
  // above held boot-time logs in memory until pino is bound; flushing
  // here makes early logs land in the JSON stream like everything else.
  app.useLogger(app.get(PinoLogger));
  const logger = app.get(PinoLogger);

  // Sentry exception filter — silently swallows nothing, just observes
  // 5xx + non-HttpException errors and forwards to Sentry. Registered
  // alongside Nest's default filter via re-throw.
  app.useGlobalFilters(new SentryExceptionFilter());

  // Security headers. Default CSP is enabled (CodeQL high-severity alert
  // js/insecure-helmet-configuration fires on `contentSecurityPolicy: false`).
  // The API responds with JSON for app routes and serves binary uploads
  // from `/uploads/*`, so the only HTML consumer of CSP here is Swagger UI;
  // its inline init script + style get a scoped relaxation a few lines below.
  // `crossOriginResourcePolicy: cross-origin` keeps `/uploads/*` loadable
  // from the web app on a different origin.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'img-src': ["'self'", 'data:', 'blob:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Swagger UI (swagger-ui-express) injects an inline initialiser script
  // and inline styles, which the default CSP would block. Scope a relaxed
  // CSP to `/api/docs` only — the rest of the API keeps the strict policy
  // set above. This middleware overwrites the CSP header on matching paths.
  app.use(
    '/api/docs',
    helmet.contentSecurityPolicy({
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https:'],
        'img-src': ["'self'", 'data:', 'blob:'],
      },
    }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global serializer — respects @Exclude() on entities
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // CORS — env-driven allow-list, no implicit localhost in production.
  app.enableCors({
    origin: buildCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('GSM Sports API')
    .setDescription('API for GSM Sports Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`GSM Sports API running on http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  if (sentryActive) {
    logger.log('Sentry error reporting enabled');
  }

  // Seed default sports (arm wrestling) if table is empty
  const sportsService = app.get(SportsService);
  await sportsService.seed();

  // Seed first admin from ENV (ADMIN_EMAIL + ADMIN_PASSWORD)
  const usersService = app.get(UsersService);
  await usersService.seedAdmin();
}
bootstrap();
