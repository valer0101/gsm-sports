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

const fakeHost = {} as ArgumentsHost;

describe('SentryExceptionFilter', () => {
  beforeEach(() => {
    sentryCapture.mockReset();
    process.env.SENTRY_DSN = 'https://fake@example.test/1';
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
  });

  it('forwards a thrown 5xx HttpException to Sentry and re-throws', () => {
    const filter = new SentryExceptionFilter();
    const err = new InternalServerErrorException('oops');
    expect(() => filter.catch(err, fakeHost)).toThrow(HttpException);
    expect(sentryCapture).toHaveBeenCalledTimes(1);
    expect(sentryCapture).toHaveBeenCalledWith(err);
  });

  it('forwards a non-HttpException (a real bug) to Sentry and re-throws', () => {
    const filter = new SentryExceptionFilter();
    const err = new Error('crash');
    expect(() => filter.catch(err, fakeHost)).toThrow(Error);
    expect(sentryCapture).toHaveBeenCalledWith(err);
  });

  it.each([
    ['BadRequest', () => new BadRequestException('bad input')],
    ['NotFound', () => new NotFoundException('missing')],
    ['Forbidden', () => new ForbiddenException('nope')],
  ])('does NOT forward 4xx %s to Sentry', (_label, makeErr) => {
    const filter = new SentryExceptionFilter();
    const err = makeErr();
    expect(() => filter.catch(err, fakeHost)).toThrow(HttpException);
    expect(sentryCapture).not.toHaveBeenCalled();
  });

  it('does NOT forward when SENTRY_DSN is unset (init was a no-op)', () => {
    delete process.env.SENTRY_DSN;
    const filter = new SentryExceptionFilter();
    expect(() => filter.catch(new Error('boom'), fakeHost)).toThrow(Error);
    expect(sentryCapture).not.toHaveBeenCalled();
  });

  it('forwards a custom 503 HttpException (server-side outage)', () => {
    const filter = new SentryExceptionFilter();
    const err = new HttpException('service down', HttpStatus.SERVICE_UNAVAILABLE);
    expect(() => filter.catch(err, fakeHost)).toThrow(HttpException);
    expect(sentryCapture).toHaveBeenCalledWith(err);
  });

  it('survives a Sentry SDK failure without losing the original error', () => {
    sentryCapture.mockImplementationOnce(() => {
      throw new Error('Sentry SDK exploded');
    });
    const filter = new SentryExceptionFilter();
    const original = new Error('original problem');
    // The original exception must still bubble so Nest's default filter
    // produces the response — observability never swallows requests.
    expect(() => filter.catch(original, fakeHost)).toThrow('original problem');
  });
});
