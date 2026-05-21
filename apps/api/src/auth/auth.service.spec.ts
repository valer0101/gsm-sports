import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { EmailVerificationService } from './email-verification.service';
import type { GoogleProfilePayload } from './google.strategy';
import type { User } from '../users/entities/user.entity';

const baseGoogleProfile: GoogleProfilePayload = {
  googleId: 'google-123',
  email: 'aram@example.com',
  firstName: 'Aram',
  lastName: 'Sargsyan',
  avatarUrl: 'https://lh3.googleusercontent.com/a/abc',
};

const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    email: 'aram@example.com',
    firstName: 'Aram',
    lastName: 'Sargsyan',
    roles: ['user'],
    isActive: true,
    isVerified: false,
    phone: null,
    avatarUrl: null,
    googleId: null,
    passwordHash: null,
    language: 'hy',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

interface UsersMock {
  findByGoogleId: ReturnType<typeof vi.fn>;
  findByEmail: ReturnType<typeof vi.fn>;
  findByIdWithPassword: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

async function buildService(): Promise<{ service: AuthService; users: UsersMock }> {
  const users: UsersMock = {
    findByGoogleId: vi.fn(),
    findByEmail: vi.fn(),
    findByIdWithPassword: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: UsersService, useValue: users },
      { provide: JwtService, useValue: { sign: vi.fn().mockReturnValue('jwt-token') } },
      {
        provide: ConfigService,
        useValue: { get: vi.fn().mockReturnValue('dev-secret') },
      },
      {
        provide: EmailVerificationService,
        useValue: { sendVerification: vi.fn().mockResolvedValue(undefined) },
      },
    ],
  }).compile();

  return { service: module.get(AuthService), users };
}

describe('AuthService.loginWithGoogle', () => {
  let service: AuthService;
  let users: UsersMock;

  beforeEach(async () => {
    ({ service, users } = await buildService());
  });

  it('logs in an existing user already linked to the Google id', async () => {
    const existing = mockUser({ googleId: baseGoogleProfile.googleId, isVerified: true });
    users.findByGoogleId.mockResolvedValue(existing);
    users.update.mockResolvedValue(existing);

    const result = await service.loginWithGoogle(baseGoogleProfile);

    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
    expect(result.user.id).toBe(existing.id);
    expect(result.accessToken).toBe('jwt-token');
  });

  it('links the Google id to an existing email-only account', async () => {
    const existing = mockUser({ id: 'existing-id', googleId: null, avatarUrl: null });
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(existing);
    const linked = { ...existing, googleId: baseGoogleProfile.googleId, isVerified: true };
    users.update.mockResolvedValueOnce(linked).mockResolvedValueOnce(linked);

    const result = await service.loginWithGoogle(baseGoogleProfile);

    expect(users.create).not.toHaveBeenCalled();
    expect(users.update).toHaveBeenCalledWith(
      'existing-id',
      expect.objectContaining({
        googleId: baseGoogleProfile.googleId,
        isVerified: true,
        avatarUrl: baseGoogleProfile.avatarUrl,
      }),
    );
    expect(result.user.id).toBe('existing-id');
  });

  it('does not overwrite a user-supplied avatar when linking Google', async () => {
    const existing = mockUser({
      id: 'existing-id',
      googleId: null,
      avatarUrl: 'https://uploads.example.com/me.png',
    });
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(existing);
    users.update.mockResolvedValue(existing);

    await service.loginWithGoogle(baseGoogleProfile);

    const linkPatch = users.update.mock.calls[0][1];
    expect(linkPatch).not.toHaveProperty('avatarUrl');
  });

  it('provisions a new account when neither Google id nor email match, using ctx.language', async () => {
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    const created = mockUser({
      id: 'new-id',
      googleId: baseGoogleProfile.googleId,
      isVerified: true,
      avatarUrl: baseGoogleProfile.avatarUrl,
      language: 'ru',
    });
    users.create.mockResolvedValue(created);
    users.update.mockResolvedValue(created);

    const result = await service.loginWithGoogle(baseGoogleProfile, { language: 'ru' });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: baseGoogleProfile.email,
        googleId: baseGoogleProfile.googleId,
        passwordHash: null,
        isVerified: true,
        roles: ['user'],
        language: 'ru',
      }),
    );
    expect(result.user.id).toBe('new-id');
    expect(result.accessToken).toBe('jwt-token');
  });

  it('recovers when a concurrent callback wins the create race', async () => {
    users.findByGoogleId.mockResolvedValueOnce(null);
    users.findByEmail.mockResolvedValueOnce(null);
    // First create attempt loses the race against a peer request:
    const uniqueViolation: Error & { code?: string; driverError?: { code?: string } } = Object.assign(
      new Error('duplicate key value violates unique constraint "UQ_users_googleId"'),
      { code: '23505', driverError: { code: '23505' } },
    );
    users.create.mockRejectedValueOnce(uniqueViolation);
    // After the race, the canonical row is now visible by googleId.
    const winner = mockUser({
      id: 'winner-id',
      googleId: baseGoogleProfile.googleId,
      isVerified: true,
    });
    users.findByGoogleId.mockResolvedValueOnce(winner);
    users.update.mockResolvedValue(winner);

    const result = await service.loginWithGoogle(baseGoogleProfile);

    expect(result.user.id).toBe('winner-id');
    // lastLoginAt update still happened on the resolved user.
    expect(users.update).toHaveBeenCalledWith('winner-id', expect.objectContaining({ lastLoginAt: expect.any(Date) }));
  });

  it('rethrows non-unique-violation errors from create', async () => {
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    users.create.mockRejectedValue(new Error('database is on fire'));

    await expect(service.loginWithGoogle(baseGoogleProfile)).rejects.toThrow('database is on fire');
  });
});

describe('AuthService.resolveLanguage', () => {
  let service: AuthService;

  beforeEach(async () => {
    ({ service } = await buildService());
  });

  it.each([
    ['ru,en;q=0.9', 'ru'],
    ['en-US,en;q=0.9', 'en'],
    ['hy', 'hy'],
    ['fr-FR', 'hy'],
    [undefined, 'hy'],
    ['', 'hy'],
  ])('maps Accept-Language %s → %s', (header, expected) => {
    expect(service.resolveLanguage(header as string | undefined)).toBe(expected);
  });
});

describe('AuthService.setPassword', () => {
  let service: AuthService;
  let users: UsersMock;

  beforeEach(async () => {
    ({ service, users } = await buildService());
  });

  it('throws NotFoundException when the user is missing', async () => {
    users.findByIdWithPassword.mockResolvedValue(null);
    await expect(service.setPassword('missing', { password: 'secret123' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sets the password for a Google-only user (no current password required)', async () => {
    const googleOnly = mockUser({ id: 'g-id', passwordHash: null });
    users.findByIdWithPassword.mockResolvedValue(googleOnly);
    users.update.mockResolvedValue(googleOnly);

    const res = await service.setPassword('g-id', { password: 'newSecret123' });

    expect(res).toEqual({ message: 'Password updated' });
    expect(users.update).toHaveBeenCalledWith(
      'g-id',
      expect.objectContaining({ passwordHash: expect.any(String) }),
    );
    const [[, patch]] = users.update.mock.calls;
    const stored = (patch as { passwordHash: string }).passwordHash;
    expect(await bcrypt.compare('newSecret123', stored)).toBe(true);
  });

  it('requires the current password when a hash is already set', async () => {
    const withPassword = mockUser({
      id: 'pw-id',
      passwordHash: await bcrypt.hash('oldSecret123', 4),
    });
    users.findByIdWithPassword.mockResolvedValue(withPassword);

    await expect(service.setPassword('pw-id', { password: 'newSecret123' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an incorrect current password', async () => {
    const withPassword = mockUser({
      id: 'pw-id',
      passwordHash: await bcrypt.hash('oldSecret123', 4),
    });
    users.findByIdWithPassword.mockResolvedValue(withPassword);

    await expect(
      service.setPassword('pw-id', { currentPassword: 'wrong', password: 'newSecret123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('changes the password when the current password matches', async () => {
    const withPassword = mockUser({
      id: 'pw-id',
      passwordHash: await bcrypt.hash('oldSecret123', 4),
    });
    users.findByIdWithPassword.mockResolvedValue(withPassword);
    users.update.mockResolvedValue(withPassword);

    const res = await service.setPassword('pw-id', {
      currentPassword: 'oldSecret123',
      password: 'newSecret123',
    });

    expect(res).toEqual({ message: 'Password updated' });
    expect(users.update).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService.register conflict', () => {
  let service: AuthService;
  let users: UsersMock;

  beforeEach(async () => {
    ({ service, users } = await buildService());
  });

  it('throws ConflictException when the email is taken', async () => {
    users.findByEmail.mockResolvedValue(mockUser());
    await expect(
      service.register({
        email: 'aram@example.com',
        password: 'secret123',
        firstName: 'Aram',
        lastName: 'Sargsyan',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('AuthService.register email verification', () => {
  it('sends a verification email after successful registration', async () => {
    const { service, users } = await buildService();
    const verify = vi.fn().mockResolvedValue(undefined);
    // Override the EmailVerificationService mock for this test:
    (service as any).emailVerification = { sendVerification: verify };

    users.findByEmail.mockResolvedValue(null);
    // The user the repo returns IS the user passed to sendVerification — so
    // align the create mock to the same email used in the assertion below.
    users.create.mockResolvedValue(mockUser({ id: 'new-user', email: 'newuser@example.com', isVerified: false }));

    await service.register({
      email: 'newuser@example.com',
      password: 'SecurePass123',
      firstName: 'Aram',
      lastName: 'Sargsyan',
    } as any);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0][0].email).toBe('newuser@example.com');
  });
});
