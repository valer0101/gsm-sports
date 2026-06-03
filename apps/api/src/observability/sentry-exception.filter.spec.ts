import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { SentryExceptionFilter } from './sentry-exception.filter';

const sentryCapture = vi.fn();

vi.mock('./sentry', () => ({
  Sentry: { captureException: (...args: unknown[]) => sentryCapture(...args) },
}));

function makeHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { status };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('SentryExceptionFilter', () => {
  beforeEach(() => {
    sentryCapture.mockReset();
    process.env.SENTRY_DSN = 'https://fake@example.test/1';
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
  });

  it('forwards a 5xx HttpException to Sentry and writes its response body', () => {
    const filter = new SentryExceptionFilter();
    const err = new InternalServerErrorException('oops');
    const { host, status, json } = makeHost();

    filter.catch(err, host);

    expect(sentryCapture).toHaveBeenCalledTimes(1);
    expect(sentryCapture).toHaveBeenCalledWith(err);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(err.getResponse());
  });

  it('forwards a non-HttpException (a real bug) to Sentry and returns generic 500', () => {
    const filter = new SentryExceptionFilter();
    const err = new Error('crash');
    const { host, status, json } = makeHost();

    filter.catch(err, host);

    expect(sentryCapture).toHaveBeenCalledWith(err);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
  });

  it.each([
    ['BadRequest', () => new BadRequestException(['sportId must be a UUID'])],
    ['NotFound', () => new NotFoundException('missing')],
    ['Forbidden', () => new ForbiddenException('nope')],
  ])('does NOT forward 4xx %s to Sentry, writes detailed JSON response', (_label, makeErr) => {
    const filter = new SentryExceptionFilter();
    const err = makeErr();
    const { host, status, json } = makeHost();

    filter.catch(err, host);

    expect(sentryCapture).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(err.getStatus());
    // Critical: the detailed Nest exception body (with `message` array)
    // must reach the client — that's the whole reason this filter exists.
    expect(json).toHaveBeenCalledWith(err.getResponse());
  });

  it('does NOT forward to Sentry when SENTRY_DSN is unset', () => {
    delete process.env.SENTRY_DSN;
    const filter = new SentryExceptionFilter();
    const { host, status, json } = makeHost();

    filter.catch(new Error('boom'), host);

    expect(sentryCapture).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalled();
  });

  it('forwards a custom 503 HttpException (server-side outage)', () => {
    const filter = new SentryExceptionFilter();
    const err = new HttpException('service down', HttpStatus.SERVICE_UNAVAILABLE);
    const { host, status, json } = makeHost();

    filter.catch(err, host);

    expect(sentryCapture).toHaveBeenCalledWith(err);
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(err.getResponse());
  });

  it('survives a Sentry SDK failure without dropping the response', () => {
    sentryCapture.mockImplementationOnce(() => {
      throw new Error('Sentry SDK exploded');
    });
    const filter = new SentryExceptionFilter();
    const original = new Error('original problem');
    const { host, status, json } = makeHost();

    // Must not throw; response still goes out so the client doesn't hang.
    expect(() => filter.catch(original, host)).not.toThrow();
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalled();
  });
});
