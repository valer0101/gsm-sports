import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
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
    language: 'en',
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
  users: { findByEmail: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; findByIdWithPassword: ReturnType<typeof vi.fn> };
  mail: { send: ReturnType<typeof vi.fn> };
  repo: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  config: { get: ReturnType<typeof vi.fn> };
}

async function buildService(): Promise<{ service: PasswordResetService; mocks: Mocks }> {
  const mocks: Mocks = {
    users: { findByEmail: vi.fn(), update: vi.fn(), findByIdWithPassword: vi.fn() },
    mail: { send: vi.fn().mockResolvedValue(undefined) },
    repo: { create: vi.fn((x) => x), save: vi.fn(), findOne: vi.fn(), update: vi.fn() },
    config: { get: vi.fn((k: string) => (k === 'NEXT_PUBLIC_SITE_URL' ? 'https://gsm.example' : undefined)) },
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PasswordResetService,
      { provide: getRepositoryToken(PasswordResetToken), useValue: mocks.repo },
      { provide: UsersService, useValue: mocks.users },
      { provide: MailService, useValue: mocks.mail },
      { provide: ConfigService, useValue: mocks.config },
    ],
  }).compile();
  return { service: module.get(PasswordResetService), mocks };
}

describe('PasswordResetService.requestReset', () => {
  let service: PasswordResetService;
  let mocks: Mocks;

  beforeEach(async () => {
    ({ service, mocks } = await buildService());
  });

  it('silently returns success when no user matches the email', async () => {
    mocks.users.findByEmail.mockResolvedValue(null);
    await expect(service.requestReset('nobody@example.com')).resolves.toBeUndefined();
    expect(mocks.repo.save).not.toHaveBeenCalled();
    expect(mocks.mail.send).not.toHaveBeenCalled();
  });

  it('saves a hashed token and sends an email when the user exists', async () => {
    mocks.users.findByEmail.mockResolvedValue(mockUser());
    mocks.repo.save.mockResolvedValue({ id: 'tok-1' });

    await service.requestReset('aram@example.com');

    expect(mocks.repo.save).toHaveBeenCalledTimes(1);
    const savedRow = mocks.repo.save.mock.calls[0][0];
    expect(savedRow.userId).toBe('user-1');
    expect(savedRow.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(savedRow.expiresAt).toBeInstanceOf(Date);

    expect(mocks.mail.send).toHaveBeenCalledTimes(1);
    const sent = mocks.mail.send.mock.calls[0][0];
    expect(sent.to).toBe('aram@example.com');
    expect(sent.html).toMatch(/https:\/\/gsm\.example\/auth\/reset-password\?token=[a-f0-9]{64}/);
    // The raw token in the URL must NOT equal the stored hash.
    const urlToken = sent.html.match(/token=([a-f0-9]{64})/)![1];
    expect(urlToken).not.toBe(savedRow.tokenHash);
  });
});

describe('PasswordResetService.consumeToken', () => {
  let service: PasswordResetService;
  let mocks: Mocks;

  beforeEach(async () => {
    ({ service, mocks } = await buildService());
  });

  function hash(t: string) {
    return crypto.createHash('sha256').update(t).digest('hex');
  }

  it('throws on unknown / expired / used token', async () => {
    mocks.repo.findOne.mockResolvedValue(null);
    await expect(service.consumeToken('badtoken', 'newpassword12')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updates password and marks token used on success', async () => {
    const raw = 'a'.repeat(64);
    const row = {
      id: 'tok-1',
      userId: 'user-1',
      tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + 10_000),
      usedAt: null,
    };
    mocks.repo.findOne.mockResolvedValue(row);

    await service.consumeToken(raw, 'newPassword12');

    expect(mocks.users.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ passwordHash: expect.any(String) }),
    );
    // bcrypt hash starts with $2
    expect((mocks.users.update.mock.calls[0][1] as any).passwordHash).toMatch(/^\$2[aby]\$/);
    expect(mocks.repo.update).toHaveBeenCalledWith(
      { id: 'tok-1' },
      expect.objectContaining({ usedAt: expect.any(Date) }),
    );
  });

  it('refuses passwords shorter than 8 chars (defense in depth — DTO also enforces)', async () => {
    const raw = 'b'.repeat(64);
    mocks.repo.findOne.mockResolvedValue({
      id: 'tok-2',
      userId: 'user-1',
      tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + 10_000),
      usedAt: null,
    });
    await expect(service.consumeToken(raw, 'short')).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.users.update).not.toHaveBeenCalled();
  });
});
