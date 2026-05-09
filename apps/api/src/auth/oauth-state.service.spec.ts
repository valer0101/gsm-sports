import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OAuthStateService } from './oauth-state.service';

describe('OAuthStateService', () => {
  let service: OAuthStateService;
  let jwt: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthStateService,
        {
          provide: JwtService,
          useValue: new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
        },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    service = module.get(OAuthStateService);
    jwt = module.get(JwtService);
  });

  it('round-trips a same-origin redirect', () => {
    const token = service.sign({ redirect: '/admin/foo' });
    const decoded = service.verify(token);
    expect(decoded.redirect).toBe('/admin/foo');
    expect(decoded.type).toBe('oauth-state');
  });

  it('strips absolute URLs (open-redirect guard)', () => {
    const token = service.sign({ redirect: 'https://evil.com/phish' });
    const decoded = service.verify(token);
    expect(decoded.redirect).toBeNull();
  });

  it('strips protocol-relative URLs', () => {
    const token = service.sign({ redirect: '//evil.com/phish' });
    const decoded = service.verify(token);
    expect(decoded.redirect).toBeNull();
  });

  it('rejects a missing state token', () => {
    expect(() => service.verify(null)).toThrow(BadRequestException);
    expect(() => service.verify('')).toThrow(BadRequestException);
  });

  it('rejects a token signed with a different secret', () => {
    const foreign = new JwtService({ secret: 'other-secret' });
    const tampered = foreign.sign({ type: 'oauth-state', redirect: '/admin' });
    expect(() => service.verify(tampered)).toThrow(BadRequestException);
  });

  it('rejects a token of the wrong type (e.g. a leaked session JWT)', () => {
    const sessionLike = jwt.sign({ sub: 'user-1', email: 'u@e.com', roles: ['user'] });
    expect(() => service.verify(sessionLike)).toThrow(BadRequestException);
  });

  it('rejects redirects longer than the configured cap', () => {
    const long = '/' + 'a'.repeat(500);
    const token = service.sign({ redirect: long });
    const decoded = service.verify(token);
    expect(decoded.redirect).toBeNull();
  });
});
