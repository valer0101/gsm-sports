import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthStateService } from './oauth-state.service';
import { PasswordResetService } from './password-reset.service';
import type { GoogleProfilePayload } from './google.strategy';

const profile: GoogleProfilePayload = {
  googleId: 'google-1',
  email: 'aram@example.com',
  firstName: 'Aram',
  lastName: 'Sargsyan',
  avatarUrl: null,
};

function buildResponseStub() {
  const cookies: Array<{ name: string; value: string; opts: unknown }> = [];
  let redirectedTo: string | null = null;
  return {
    cookie(name: string, value: string, opts: unknown) {
      cookies.push({ name, value, opts });
    },
    redirect(url: string) {
      redirectedTo = url;
    },
    get cookies() {
      return cookies;
    },
    get redirectedTo() {
      return redirectedTo;
    },
  };
}

describe('AuthController.googleCallback', () => {
  let controller: AuthController;
  let auth: { loginWithGoogle: ReturnType<typeof vi.fn>; resolveLanguage: ReturnType<typeof vi.fn> };
  let oauthState: { verify: ReturnType<typeof vi.fn> };
  let config: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = {
      loginWithGoogle: vi.fn(),
      resolveLanguage: vi.fn().mockReturnValue('hy'),
    };
    oauthState = { verify: vi.fn() };
    config = { get: vi.fn().mockReturnValue('https://app.example.com/auth/google/callback') };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: OAuthStateService, useValue: oauthState },
        { provide: ConfigService, useValue: config },
        {
          provide: PasswordResetService,
          useValue: { requestReset: vi.fn(), consumeToken: vi.fn() },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('sets the access_token cookie and redirects to the frontend with the unwrapped redirect', async () => {
    oauthState.verify.mockReturnValue({ type: 'oauth-state', redirect: '/admin/users' });
    auth.loginWithGoogle.mockResolvedValue({
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: profile.email, firstName: 'Aram', lastName: 'S', roles: ['user'] },
    });
    const res = buildResponseStub();
    const req = {
      query: { state: 'signed-state' },
      headers: { 'accept-language': 'ru,en;q=0.9' },
      user: profile,
    } as never;

    await controller.googleCallback(req, res as never);

    expect(oauthState.verify).toHaveBeenCalledWith('signed-state');
    expect(auth.loginWithGoogle).toHaveBeenCalledWith(profile, { language: 'hy' });
    expect(res.cookies).toEqual([
      expect.objectContaining({
        name: 'access_token',
        value: 'jwt-token',
        opts: expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      }),
    ]);
    expect(res.redirectedTo).toBe(
      'https://app.example.com/auth/google/callback?status=ok&redirect=%2Fadmin%2Fusers',
    );
  });

  it('redirects to the frontend with status=error when state verification fails', async () => {
    oauthState.verify.mockImplementation(() => {
      throw new Error('Invalid OAuth state');
    });
    const res = buildResponseStub();
    const req = {
      query: { state: 'tampered' },
      headers: {},
      user: profile,
    } as never;

    await controller.googleCallback(req, res as never);

    expect(auth.loginWithGoogle).not.toHaveBeenCalled();
    expect(res.cookies).toEqual([]);
    expect(res.redirectedTo).toBe('https://app.example.com/auth/google/callback?status=error');
  });

  it('redirects with status=error when loginWithGoogle throws', async () => {
    oauthState.verify.mockReturnValue({ type: 'oauth-state', redirect: null });
    auth.loginWithGoogle.mockRejectedValue(new Error('db down'));
    const res = buildResponseStub();
    const req = { query: { state: 's' }, headers: {}, user: profile } as never;

    await controller.googleCallback(req, res as never);

    expect(res.cookies).toEqual([]);
    expect(res.redirectedTo).toBe('https://app.example.com/auth/google/callback?status=error');
  });

  it('omits the redirect query param when state had no redirect', async () => {
    oauthState.verify.mockReturnValue({ type: 'oauth-state', redirect: null });
    auth.loginWithGoogle.mockResolvedValue({
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: profile.email, firstName: 'Aram', lastName: 'S', roles: ['user'] },
    });
    const res = buildResponseStub();
    const req = { query: { state: 's' }, headers: {}, user: profile } as never;

    await controller.googleCallback(req, res as never);

    expect(res.redirectedTo).toBe('https://app.example.com/auth/google/callback?status=ok');
  });
});

describe('AuthController.setPassword', () => {
  let controller: AuthController;
  let auth: { setPassword: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = { setPassword: vi.fn().mockResolvedValue({ message: 'Password updated' }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: OAuthStateService, useValue: { verify: vi.fn() } },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        {
          provide: PasswordResetService,
          useValue: { requestReset: vi.fn(), consumeToken: vi.fn() },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('forwards the authenticated user id and DTO to the service', async () => {
    const req = { user: { sub: 'user-42' } } as never;

    const result = await controller.setPassword(req, { password: 'newSecret123' });

    expect(auth.setPassword).toHaveBeenCalledWith('user-42', { password: 'newSecret123' });
    expect(result).toEqual({ message: 'Password updated' });
  });
});

describe('AuthController password reset', () => {
  it('POST /v1/auth/forgot-password calls service and always returns 200', async () => {
    const reset = { requestReset: vi.fn().mockResolvedValue(undefined), consumeToken: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: OAuthStateService, useValue: {} },
        { provide: PasswordResetService, useValue: reset },
      ],
    }).compile();
    const controller = moduleRef.get(AuthController);
    const result = await controller.forgotPassword({ email: 'aram@example.com' });
    expect(reset.requestReset).toHaveBeenCalledWith('aram@example.com');
    expect(result).toEqual({ message: expect.any(String) });
  });

  it('POST /v1/auth/reset-password delegates to consumeToken', async () => {
    const reset = { requestReset: vi.fn(), consumeToken: vi.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: OAuthStateService, useValue: {} },
        { provide: PasswordResetService, useValue: reset },
      ],
    }).compile();
    const controller = moduleRef.get(AuthController);
    await controller.resetPassword({ token: 'a'.repeat(64), password: 'newPass123' });
    expect(reset.consumeToken).toHaveBeenCalledWith('a'.repeat(64), 'newPass123');
  });
});
