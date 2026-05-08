import { LoggerModule } from 'nestjs-pino';

/**
 * Structured JSON logging via pino. Replaces NestJS's ad-hoc `Logger`
 * usage in production with a single, queryable log stream.
 *
 * Behaviour:
 *   - Production: JSON to stdout (one log per line) with redaction
 *     of common credential fields. Hosting platforms (Railway,
 *     Render, Fly.io, GCP Cloud Run) ingest this directly.
 *   - Dev: pretty-printed colour output via pino-pretty so local
 *     development stays readable.
 *
 * Request correlation is on by default — every HTTP request gets a
 * `reqId` field so a single user action can be traced across logs.
 *
 * Health-probe endpoints are excluded from request logs to keep
 * orchestrator pings out of the volume budget.
 */
export const PinoLoggerModule = LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

    // Redact secret-shaped fields from the log output. Pino's redact engine
    // walks every log line; cheap O(N) pass. Keep this list narrow — wide
    // redaction makes incident debugging hell.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.passwordConfirm',
        'req.body.refreshToken',
        '*.password',
        '*.accessToken',
        '*.refreshToken',
        '*.jwt',
      ],
      censor: '[REDACTED]',
    },

    // Don't spam the logs with health/uptime probes — pings come every
    // few seconds and would otherwise dominate the volume.
    autoLogging: {
      ignore: (req) => {
        const url = req.url ?? '';
        return url === '/health' || url === '/ready' || url.startsWith('/health?') || url.startsWith('/ready?');
      },
    },

    transport:
      process.env.NODE_ENV === 'production'
        ? undefined // raw JSON in prod — log aggregator parses it
        : {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname,reqId',
            },
          },
  },
});
