import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('AuthService.loginWithGoogle', () => {
  let service: AuthService;
  let users: {
    findByGoogleId: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    users = {
      findByGoogleId: vi.fn(),
      findByEmail: vi.fn(),
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
      ],
    }).compile();

    service = module.get(AuthService);
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

  it('provisions a new account when neither Google id nor email match', async () => {
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    const created = mockUser({
      id: 'new-id',
      googleId: baseGoogleProfile.googleId,
      isVerified: true,
      avatarUrl: baseGoogleProfile.avatarUrl,
    });
    users.create.mockResolvedValue(created);
    users.update.mockResolvedValue(created);

    const result = await service.loginWithGoogle(baseGoogleProfile);

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: baseGoogleProfile.email,
        googleId: baseGoogleProfile.googleId,
        passwordHash: null,
        isVerified: true,
        roles: ['user'],
      }),
    );
    expect(result.user.id).toBe('new-id');
    expect(result.accessToken).toBe('jwt-token');
  });
});
