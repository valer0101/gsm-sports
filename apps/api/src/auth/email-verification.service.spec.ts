import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import type { User } from '../users/entities/user.entity';

const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'aram@example.com',
    firstName: 'Aram',
    lastName: 'X',
    roles: ['user'],
    language: 'ru',
    isVerified: false,
    isActive: true,
    phone: null,
    avatarUrl: null,
    googleId: null,
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

interface Mocks {
  users: { findById: ReturnType<typeof vi.fn>; findByEmail: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  mail: { send: ReturnType<typeof vi.fn> };
  repo: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  config: { get: ReturnType<typeof vi.fn> };
}

async function build(): Promise<{ service: EmailVerificationService; mocks: Mocks }> {
  const mocks: Mocks = {
    users: { findById: vi.fn(), findByEmail: vi.fn(), update: vi.fn() },
    mail: { send: vi.fn().mockResolvedValue(undefined) },
    repo: { create: vi.fn((x) => x), save: vi.fn(), findOne: vi.fn(), update: vi.fn() },
    config: { get: vi.fn((k: string) => (k === 'NEXT_PUBLIC_SITE_URL' ? 'https://gsm.example' : undefined)) },
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EmailVerificationService,
      { provide: getRepositoryToken(EmailVerificationToken), useValue: mocks.repo },
      { provide: UsersService, useValue: mocks.users },
      { provide: MailService, useValue: mocks.mail },
      { provide: ConfigService, useValue: mocks.config },
    ],
  }).compile();
  return { service: module.get(EmailVerificationService), mocks };
}

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let mocks: Mocks;
  beforeEach(async () => {
    ({ service, mocks } = await build());
  });

  it('sendVerification: saves hash and emails plaintext', async () => {
    await service.sendVerification(mockUser());
    expect(mocks.repo.save).toHaveBeenCalled();
    expect(mocks.mail.send).toHaveBeenCalled();
    const sent = mocks.mail.send.mock.calls[0][0];
    expect(sent.html).toMatch(/https:\/\/gsm\.example\/auth\/verify-email\?token=[a-f0-9]{64}/);
  });

  it('sendVerification: no-op if user is already verified', async () => {
    await service.sendVerification(mockUser({ isVerified: true }));
    expect(mocks.repo.save).not.toHaveBeenCalled();
    expect(mocks.mail.send).not.toHaveBeenCalled();
  });

  it('verifyToken: marks user verified and token used', async () => {
    const raw = 'a'.repeat(64);
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    mocks.repo.findOne.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    await service.verifyToken(raw);
    expect(mocks.users.update).toHaveBeenCalledWith('user-1', { isVerified: true });
    expect(mocks.repo.update).toHaveBeenCalledWith(
      { id: 'tok-1' },
      expect.objectContaining({ usedAt: expect.any(Date) }),
    );
  });

  it('verifyToken: rejects bad / expired token', async () => {
    mocks.repo.findOne.mockResolvedValue(null);
    await expect(service.verifyToken('z'.repeat(64))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resendVerification: sends a fresh email when user exists and not yet verified', async () => {
    mocks.users.findByEmail.mockResolvedValue(mockUser());
    await service.resendVerification('aram@example.com');
    expect(mocks.mail.send).toHaveBeenCalled();
  });

  it('resendVerification: silently returns when user does not exist or is already verified', async () => {
    mocks.users.findByEmail.mockResolvedValueOnce(null);
    await service.resendVerification('nobody@example.com');
    mocks.users.findByEmail.mockResolvedValueOnce(mockUser({ isVerified: true }));
    await service.resendVerification('aram@example.com');
    expect(mocks.mail.send).not.toHaveBeenCalled();
  });
});
