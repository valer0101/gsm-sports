import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';

function makeConfig(env: Record<string, string | undefined>) {
  return {
    get: vi.fn((key: string, def?: string) => env[key] ?? def),
  };
}

describe('TelegramService', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch') as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('stub mode (no token)', () => {
    let service: TelegramService;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          TelegramService,
          { provide: ConfigService, useValue: makeConfig({}) },
        ],
      }).compile();
      service = module.get(TelegramService);
    });

    it('reports not configured', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('does NOT call fetch; returns { sent: false }', async () => {
      const result = await service.sendMessage('12345', 'hello world');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ sent: false, chatId: '12345', messageId: null });
    });

    it('tolerates very long text without crashing (preview is truncated)', async () => {
      const long = 'x'.repeat(10_000);
      await expect(service.sendMessage('1', long)).resolves.toMatchObject({ sent: false });
    });
  });

  describe('live mode (token set)', () => {
    let service: TelegramService;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          TelegramService,
          {
            provide: ConfigService,
            useValue: makeConfig({
              TELEGRAM_BOT_TOKEN: '123456789:AABBCCDDEEFFGGHHIIJJKK',
            }),
          },
        ],
      }).compile();
      service = module.get(TelegramService);
    });

    it('reports configured', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('POSTs to the Telegram Bot API with the right shape', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 42 } }),
      } as any);

      const result = await service.sendMessage(999_000, '<b>hi</b>');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://api.telegram.org/bot123456789:AABBCCDDEEFFGGHHIIJJKK/sendMessage',
      );
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({
        chat_id: 999_000,
        text: '<b>hi</b>',
        parse_mode: 'HTML',
        disable_notification: false,
      });
      expect(result).toEqual({ sent: true, chatId: 999_000, messageId: 42 });
    });

    it('honours disableNotification', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 1 } }),
      } as any);

      await service.sendMessage('1', 'silent', { disableNotification: true });
      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.disable_notification).toBe(true);
    });

    it('throws on HTTP error (non-2xx)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Too Many Requests',
      } as any);

      await expect(service.sendMessage('1', 'x')).rejects.toThrow(/429/);
    });

    it('throws on Telegram-level rejection (ok:false)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, description: 'chat not found' }),
      } as any);

      await expect(service.sendMessage('999', 'x')).rejects.toThrow(/chat not found/);
    });

    it('treats a suspiciously short token as stub mode (typo / placeholder)', async () => {
      const module = await Test.createTestingModule({
        providers: [
          TelegramService,
          {
            provide: ConfigService,
            useValue: makeConfig({ TELEGRAM_BOT_TOKEN: 'foo' }),
          },
        ],
      }).compile();
      const shortTokenService = module.get(TelegramService);

      expect(shortTokenService.isConfigured()).toBe(false);
      const result = await shortTokenService.sendMessage('1', 'x');
      expect(result.sent).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('setWebhook', () => {
    let service: TelegramService;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          TelegramService,
          {
            provide: ConfigService,
            useValue: makeConfig({
              TELEGRAM_BOT_TOKEN: '123456789:AABBCCDDEEFFGGHHIIJJKK',
            }),
          },
        ],
      }).compile();
      service = module.get(TelegramService);
    });

    it('POSTs setWebhook with url + secret_token + allowed_updates', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as any);

      await service.setWebhook(
        'https://api.example.com/v1/telegram/webhook',
        'super-secret',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://api.telegram.org/bot123456789:AABBCCDDEEFFGGHHIIJJKK/setWebhook',
      );
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({
        url: 'https://api.example.com/v1/telegram/webhook',
        secret_token: 'super-secret',
        allowed_updates: ['message'],
        // Safe default: do NOT drop queued updates. Athletes who tapped
        // their deep-link during a webhook downtime still get linked.
        drop_pending_updates: false,
      });
    });

    it('honours explicit opt-in to drop pending updates', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as any);

      await service.setWebhook(
        'https://api.example.com/v1/telegram/webhook',
        'super-secret',
        { dropPendingUpdates: true },
      );

      const body = JSON.parse(
        (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.drop_pending_updates).toBe(true);
    });

    it('throws when stub-mode (no token)', async () => {
      const module = await Test.createTestingModule({
        providers: [
          TelegramService,
          { provide: ConfigService, useValue: makeConfig({}) },
        ],
      }).compile();
      const stub = module.get(TelegramService);

      await expect(
        stub.setWebhook('https://x/v1/telegram/webhook', 's'),
      ).rejects.toThrow(/TELEGRAM_BOT_TOKEN/);
    });

    it('throws on Telegram rejection', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, description: 'invalid url' }),
      } as any);

      await expect(
        service.setWebhook('https://x/v1/telegram/webhook', 's'),
      ).rejects.toThrow(/invalid url/);
    });
  });
});
