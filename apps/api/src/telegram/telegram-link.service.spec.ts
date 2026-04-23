import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramLink } from './entities/telegram-link.entity';

const mockRepo = () => ({
  findOne: vi.fn(),
  create: vi.fn((v) => v),
  save: vi.fn(async (v) => v),
  remove: vi.fn(),
  createQueryBuilder: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue([]),
  })),
});

const mockJwt = () => ({
  sign: vi.fn(() => 'signed.jwt.token'),
  verify: vi.fn(),
});

function makeConfig(env: Record<string, string | undefined>) {
  return {
    get: vi.fn((key: string, def?: string) => env[key] ?? def),
  };
}

describe('TelegramLinkService', () => {
  let service: TelegramLinkService;
  let repo: ReturnType<typeof mockRepo>;
  let jwt: ReturnType<typeof mockJwt>;

  async function buildService(env: Record<string, string | undefined> = {}) {
    const module = await Test.createTestingModule({
      providers: [
        TelegramLinkService,
        { provide: getRepositoryToken(TelegramLink), useFactory: mockRepo },
        { provide: JwtService, useFactory: mockJwt },
        {
          provide: ConfigService,
          useValue: makeConfig({ TELEGRAM_BOT_USERNAME: 'gsm_armwrestling_bot', ...env }),
        },
      ],
    }).compile();
    service = module.get(TelegramLinkService);
    repo = module.get(getRepositoryToken(TelegramLink));
    jwt = module.get(JwtService);
  }

  afterEach(() => vi.clearAllMocks());

  describe('issueLinkToken', () => {
    beforeEach(() => buildService());

    it('returns a signed token + deep-link to the configured bot', async () => {
      const result = await service.issueLinkToken('user-1');

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-1', purpose: 'telegram-link' },
        expect.objectContaining({ expiresIn: 15 * 60 }),
      );
      expect(result.token).toBe('signed.jwt.token');
      expect(result.deepLink).toBe(
        'https://t.me/gsm_armwrestling_bot?start=signed.jwt.token',
      );
      expect(result.expiresAt).toEqual(expect.any(String));
    });

    it('rejects when TELEGRAM_BOT_USERNAME is not configured', async () => {
      await buildService({ TELEGRAM_BOT_USERNAME: undefined });
      await expect(service.issueLinkToken('user-1')).rejects.toThrow(BadRequestException);
    });

    it('URL-encodes the token in the deep-link so "+"/"/" survive the round-trip', async () => {
      jwt.sign.mockReturnValueOnce('abc.def/ghi+jkl=');
      const result = await service.issueLinkToken('user-1');
      expect(result.deepLink).toBe(
        'https://t.me/gsm_armwrestling_bot?start=' + encodeURIComponent('abc.def/ghi+jkl='),
      );
    });
  });

  describe('completeLink', () => {
    beforeEach(() => buildService());

    it('creates a link when none exists for the user', async () => {
      jwt.verify.mockReturnValueOnce({ userId: 'user-1', purpose: 'telegram-link' });
      repo.findOne.mockResolvedValueOnce(null);

      const link = await service.completeLink('t', 123_456_789);

      expect(repo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        chatId: '123456789',
      });
      expect(link.userId).toBe('user-1');
      expect(link.chatId).toBe('123456789');
    });

    it('updates the chat id when the user already has a link (re-linked from new phone)', async () => {
      jwt.verify.mockReturnValueOnce({ userId: 'user-1', purpose: 'telegram-link' });
      repo.findOne.mockResolvedValueOnce({
        id: 'link-1',
        userId: 'user-1',
        chatId: 'old',
      });

      const link = await service.completeLink('t', 'new-chat');
      expect(link.chatId).toBe('new-chat');
      expect(repo.save).toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled(); // reused existing row
    });

    it('rejects a token with wrong purpose (anti-replay vs session tokens)', async () => {
      jwt.verify.mockReturnValueOnce({ userId: 'user-1', purpose: 'session' });
      await expect(service.completeLink('access-token', 1)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired / invalid token', async () => {
      jwt.verify.mockImplementationOnce(() => {
        throw new Error('jwt expired');
      });
      await expect(service.completeLink('bad', 1)).rejects.toThrow(UnauthorizedException);
    });

    it('stores chatId as string to preserve bigint precision', async () => {
      jwt.verify.mockReturnValueOnce({ userId: 'user-1', purpose: 'telegram-link' });
      repo.findOne.mockResolvedValueOnce(null);
      // Large chat id; JS number would lose precision past 2^53.
      const bigChatId = '9007199254740993';
      await service.completeLink('t', bigChatId);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ chatId: bigChatId }),
      );
    });
  });

  describe('unlink', () => {
    beforeEach(() => buildService());

    it('removes the link when one exists', async () => {
      const existing = { id: 'l1', userId: 'user-1' };
      repo.findOne.mockResolvedValueOnce(existing);
      await service.unlink('user-1');
      expect(repo.remove).toHaveBeenCalledWith(existing);
    });

    it('is idempotent on missing link', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.unlink('user-1')).resolves.toBeUndefined();
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  describe('getChatId / findByUser', () => {
    beforeEach(() => buildService());

    it('getChatId returns the stored chatId when linked', async () => {
      repo.findOne.mockResolvedValueOnce({ chatId: '555' });
      expect(await service.getChatId('user-1')).toBe('555');
    });

    it('getChatId returns null when not linked', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      expect(await service.getChatId('user-1')).toBeNull();
    });
  });

  describe('production secret guard', () => {
    it('refuses to start in production without JWT_TELEGRAM_LINK_SECRET set', async () => {
      const prodConfig = {
        get: vi.fn((key: string) => {
          if (key === 'JWT_TELEGRAM_LINK_SECRET') return undefined;
          if (key === 'NODE_ENV') return 'production';
          return undefined;
        }),
      };

      await expect(
        Test.createTestingModule({
          providers: [
            TelegramLinkService,
            { provide: getRepositoryToken(TelegramLink), useFactory: mockRepo },
            { provide: JwtService, useFactory: mockJwt },
            { provide: ConfigService, useValue: prodConfig },
          ],
        }).compile(),
      ).rejects.toThrow(/JWT_TELEGRAM_LINK_SECRET must be set in production/);
    });
  });
});
