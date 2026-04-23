import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { TelegramUpdateService } from './telegram-update.service';
import { TelegramLinkService } from './telegram-link.service';

const mockLinkService = {
  completeLink: vi.fn(),
};

describe('TelegramUpdateService', () => {
  let service: TelegramUpdateService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TelegramUpdateService,
        { provide: TelegramLinkService, useValue: mockLinkService },
      ],
    }).compile();
    service = module.get(TelegramUpdateService);
  });

  afterEach(() => vi.clearAllMocks());

  it('ignores updates without a message (edited_message, callback_query, etc.)', async () => {
    await service.handleUpdate({ update_id: 1 });
    expect(mockLinkService.completeLink).not.toHaveBeenCalled();
  });

  it('ignores messages without text (stickers, photos)', async () => {
    await service.handleUpdate({
      update_id: 1,
      message: { message_id: 1, chat: { id: 42 } },
    });
    expect(mockLinkService.completeLink).not.toHaveBeenCalled();
  });

  it('ignores messages that are not commands', async () => {
    await service.handleUpdate({
      update_id: 1,
      message: { message_id: 1, chat: { id: 42 }, text: 'hello bot' },
    });
    expect(mockLinkService.completeLink).not.toHaveBeenCalled();
  });

  it('invokes completeLink on `/start <token>`', async () => {
    mockLinkService.completeLink.mockResolvedValueOnce({ id: 'l1' });
    await service.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 12345 },
        text: '/start abc.def.ghi',
      },
    });
    expect(mockLinkService.completeLink).toHaveBeenCalledWith('abc.def.ghi', 12345);
  });

  it('tolerates `/start@BotUsername <token>` (Telegram group form)', async () => {
    mockLinkService.completeLink.mockResolvedValueOnce({ id: 'l1' });
    await service.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 12345 },
        text: '/start@gsm_armwrestling_bot abc.def.ghi',
      },
    });
    expect(mockLinkService.completeLink).toHaveBeenCalledWith('abc.def.ghi', 12345);
  });

  it('ignores a bare `/start` with no token', async () => {
    await service.handleUpdate({
      update_id: 1,
      message: { message_id: 1, chat: { id: 42 }, text: '/start' },
    });
    expect(mockLinkService.completeLink).not.toHaveBeenCalled();
  });

  it('does NOT throw when completeLink rejects (expired / replay) — swallow + log', async () => {
    mockLinkService.completeLink.mockRejectedValueOnce(new Error('jwt expired'));
    await expect(
      service.handleUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 42 },
          text: '/start stale-token',
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('trims leading/trailing whitespace in message text', async () => {
    mockLinkService.completeLink.mockResolvedValueOnce({ id: 'l1' });
    await service.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 42 },
        text: '   /start xyz   ',
      },
    });
    expect(mockLinkService.completeLink).toHaveBeenCalledWith('xyz', 42);
  });

  it('does NOT throw when `text` is not a string (spoofed / bad update shape)', async () => {
    await expect(
      service.handleUpdate({
        update_id: 9,
        message: {
          message_id: 1,
          chat: { id: 42 },
          // Breaks the type contract — simulates a malformed update that
          // would otherwise throw when we call `.trim()` on it.
          text: 123 as unknown as string,
        },
      }),
    ).resolves.toBeUndefined();
    expect(mockLinkService.completeLink).not.toHaveBeenCalled();
  });
});
