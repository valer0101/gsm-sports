import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramUpdateService } from './telegram-update.service';

const mockUpdateService = {
  handleUpdate: vi.fn().mockResolvedValue(undefined),
};

function makeConfig(env: Record<string, string | undefined>) {
  return { get: vi.fn((key: string) => env[key]) };
}

describe('TelegramWebhookController', () => {
  let controller: TelegramWebhookController;

  async function buildController(env: Record<string, string | undefined>) {
    const module = await Test.createTestingModule({
      controllers: [TelegramWebhookController],
      providers: [
        { provide: TelegramUpdateService, useValue: mockUpdateService },
        { provide: ConfigService, useValue: makeConfig(env) },
      ],
    }).compile();
    controller = module.get(TelegramWebhookController);
  }

  afterEach(() => vi.clearAllMocks());

  it('rejects when TELEGRAM_WEBHOOK_SECRET is not configured — 401', async () => {
    await buildController({});
    await expect(
      controller.webhook('any-header', { update_id: 1 }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockUpdateService.handleUpdate).not.toHaveBeenCalled();
  });

  it('rejects when the header does not match the configured secret', async () => {
    await buildController({ TELEGRAM_WEBHOOK_SECRET: 'the-real-secret' });
    await expect(
      controller.webhook('wrong-secret', { update_id: 1 }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockUpdateService.handleUpdate).not.toHaveBeenCalled();
  });

  it('rejects when the secret header is missing', async () => {
    await buildController({ TELEGRAM_WEBHOOK_SECRET: 'the-real-secret' });
    await expect(
      controller.webhook(undefined, { update_id: 1 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('dispatches the update and returns 200 ok:true on matching secret', async () => {
    await buildController({ TELEGRAM_WEBHOOK_SECRET: 'the-real-secret' });
    const update = {
      update_id: 1,
      message: { message_id: 1, chat: { id: 42 }, text: '/start abc' },
    };

    const result = await controller.webhook('the-real-secret', update);

    expect(result).toEqual({ ok: true });
    expect(mockUpdateService.handleUpdate).toHaveBeenCalledWith(update);
  });
});
