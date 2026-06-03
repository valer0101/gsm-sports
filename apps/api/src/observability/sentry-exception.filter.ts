import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Sentry } from './sentry';

/**
 * Catch-all filter that forwards unexpected errors to Sentry AND writes a
 * standard NestJS-shaped JSON response.
 *
 * Filtering rules:
 *   - 4xx HttpExceptions are intentional client errors (validation,
 *     "not found", "forbidden") — NOT sent to Sentry. They'd flood
 *     the project with noise.
 *   - 5xx HttpExceptions and any non-HttpException (real bugs) ARE sent.
 *
 * Response shape:
 *   - HttpException → use its own `.getResponse()` (preserves Nest's
 *     `{ statusCode, message: string|string[], error }` shape, which is
 *     what the web client expects).
 *   - Any other error → generic 500 JSON. The underlying message is
 *     deliberately not exposed.
 *
 * Why a self-contained response (vs. extending BaseExceptionFilter and
 * calling super.catch): registering globally via `useGlobalFilters(new
 * SentryExceptionFilter())` doesn't give us the HttpAdapterHost that
 * BaseExceptionFilter relies on. The previous implementation tried to
 * re-throw to "let Nest take over" — but a `throw` from a global filter
 * escapes Nest's exception chain entirely and lands in Express's default
 * handler, which returns a generic `<html><pre>Bad Request</pre></html>`
 * page. That broke every 4xx/5xx response in prod (validation errors,
 * 404s, 401s) by hiding the JSON body from the browser. Writing the
 * response directly here is simpler and keeps the contract explicit.
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
        // move on so the response still goes out.
        this.logger.error(
          `Sentry capture failed: ${sentryErr instanceof Error ? sentryErr.message : 'unknown'}`,
        );
      }
    }

    const response = host.switchToHttp().getResponse();
    const body = isHttp
      ? exception.getResponse()
      : { statusCode: 500, message: 'Internal server error' };
    response.status(status).json(body);
  }
}
