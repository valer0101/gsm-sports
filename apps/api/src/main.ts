import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { SportsService } from './sports/sports.service';
import { UsersService } from './users/users.service';

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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.use(cookieParser());
  // Trust the first proxy hop so `req.ip` reflects the client (not the
  // load balancer) — required for ThrottlerGuard to bucket by client IP
  // when the API runs behind Railway / Render / Cloudflare.
  app.set('trust proxy', 1);
  const logger = new Logger('Bootstrap');

  // Security headers — sensible defaults from helmet. CSP is left in
  // permissive mode (`contentSecurityPolicy: false`) because the API
  // serves uploaded user content via /uploads/ and Swagger UI inline
  // scripts; the web app sets its own CSP at the Next.js layer.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
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

  // Seed default sports (arm wrestling) if table is empty
  const sportsService = app.get(SportsService);
  await sportsService.seed();

  // Seed first admin from ENV (ADMIN_EMAIL + ADMIN_PASSWORD)
  const usersService = app.get(UsersService);
  await usersService.seedAdmin();
}
bootstrap();
