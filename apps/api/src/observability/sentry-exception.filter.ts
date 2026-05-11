import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Sentry } from './sentry';

/**
 * Catch-all filter that forwards unexpected errors to Sentry while keeping
 * NestJS's default response shape. Attached AFTER the standard
 * BaseExceptionFilter; it doesn't replace it — it just observes.
 *
 * Filtering rules:
 *   - 4xx HttpExceptions are intentional client errors (validation,
 *     "not found", "forbidden") — NOT sent to Sentry. They'd flood
 *     the project with noise.
 *   - 5xx HttpExceptions and any non-HttpException (real bugs) ARE sent.
 *
 * The filter never swallows the error — it always re-throws so Nest's
 * default behaviour (build a JSON 500 response, log to the bound logger)
 * runs as usual.
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : 500;
    const isServerError = !isHttp || status >= 500;

    if (isServerError && process.env.SENTRY_DSN) {
      try {
        Sentry.captureException(exception);
      } catch (sentryErr) {
        // Never let the observability layer crash the request — log and
        // move on. The original exception still bubbles to Nest's default
        // filter via the throw below.
        this.logger.error(
          `Sentry capture failed: ${sentryErr instanceof Error ? sentryErr.message : 'unknown'}`,
        );
      }
    }

    // Re-throw so Nest's default filter still produces the response.
    throw exception;
  }
}
