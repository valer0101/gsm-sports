import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { TelegramNotificationsService } from './telegram-notifications.service';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';
import { MatchNotification } from './entities/match-notification.entity';

const mockTelegram = {
  sendMessage: vi.fn(),
};
const mockLinkService = {
  getChatId: vi.fn(),
  getChatIdsForUsers: vi.fn(),
};
const mockRepo = () => ({
  insert: vi.fn(),
});

describe('TelegramNotificationsService', () => {
  let service: TelegramNotificationsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TelegramNotificationsService,
        { provide: TelegramService, useValue: mockTelegram },
        { provide: TelegramLinkService, useValue: mockLinkService },
        { provide: getRepositoryToken(MatchNotification), useFactory: mockRepo },
      ],
    }).compile();
    service = module.get(TelegramNotificationsService);
    repo = module.get(getRepositoryToken(MatchNotification));
  });

  afterEach(() => vi.clearAllMocks());

  describe('notifyOpponentWithdrew', () => {
    it('silently skips when winner has no linked Telegram', async () => {
      mockLinkService.getChatId.mockResolvedValueOnce(null);
      await service.notifyOpponentWithdrew({
        tournamentId: 't1',
        matchId: 'm1',
        winnerUserId: 'u1',
        withdrawnPlayerName: 'Alice',
      });
      expect(repo.insert).not.toHaveBeenCalled();
      expect(mockTelegram.sendMessage).not.toHaveBeenCalled();
    });

    it('sends an HTML-escaped notification when linked and not yet notified', async () => {
      mockLinkService.getChatId.mockResolvedValueOnce('111');
      repo.insert.mockResolvedValueOnce({ identifiers: [{ id: 'n1' }] });

      await service.notifyOpponentWithdrew({
        tournamentId: 't1',
        matchId: 'm1',
        winnerUserId: 'u1',
        withdrawnPlayerName: 'Alice <script>',
        categoryLabel: 'Men <80kg>',
      });

      expect(repo.insert).toHaveBeenCalledWith({
        tournamentId: 't1',
        matchId: 'm1',
        kind: 'opponent_withdrew',
      });
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        '111',
        expect.stringContaining('Alice &lt;script&gt;'),
      );
      expect(mockTelegram.sendMessage.mock.calls[0][1]).toContain('Men &lt;80kg&gt;');
    });

    it('skips sending on dedupe conflict (already notified)', async () => {
      mockLinkService.getChatId.mockResolvedValueOnce('111');
      const dup = new QueryFailedError('insert', [], new Error('duplicate') as unknown as string);
      (dup as unknown as { driverError: { code: string } }).driverError = { code: '23505' };
      repo.insert.mockRejectedValueOnce(dup);

      await service.notifyOpponentWithdrew({
        tournamentId: 't1',
        matchId: 'm1',
        winnerUserId: 'u1',
        withdrawnPlayerName: 'Alice',
      });

      expect(mockTelegram.sendMessage).not.toHaveBeenCalled();
    });

    it('swallows send errors (bot outage must not break caller)', async () => {
      mockLinkService.getChatId.mockResolvedValueOnce('111');
      repo.insert.mockResolvedValueOnce({ identifiers: [{ id: 'n1' }] });
      mockTelegram.sendMessage.mockRejectedValueOnce(new Error('rate-limited'));

      await expect(
        service.notifyOpponentWithdrew({
          tournamentId: 't1',
          matchId: 'm1',
          winnerUserId: 'u1',
          withdrawnPlayerName: 'Alice',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('notifyMatchReminder', () => {
    it('silently skips when no athletes are linked', async () => {
      mockLinkService.getChatIdsForUsers.mockResolvedValueOnce(new Map());
      await service.notifyMatchReminder({
        tournamentId: 't1',
        matchId: 'm1',
        athleteUserIds: ['u1', 'u2'],
        tableNumber: 3,
        minutesUntilStart: 14,
      });
      expect(repo.insert).not.toHaveBeenCalled();
    });

    it('sends a reminder to each linked athlete with opponent name', async () => {
      mockLinkService.getChatIdsForUsers.mockResolvedValueOnce(
        new Map([
          ['u1', '111'],
          ['u2', '222'],
        ]),
      );
      repo.insert.mockResolvedValueOnce({ identifiers: [{ id: 'n1' }] });

      await service.notifyMatchReminder({
        tournamentId: 't1',
        matchId: 'm1',
        athleteUserIds: ['u1', 'u2'],
        tableNumber: 7,
        minutesUntilStart: 12,
        categoryLabel: 'Adults · 80kg · right',
        opponentNames: { u1: 'Bob', u2: 'Alice' },
      });

      expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(2);
      const msg1 = mockTelegram.sendMessage.mock.calls[0];
      const msg2 = mockTelegram.sendMessage.mock.calls[1];
      expect(msg1[0]).toBe('111');
      expect(msg1[1]).toContain('стол №7');
      expect(msg1[1]).toContain('~12');
      expect(msg1[1]).toContain('<b>Bob</b>');
      expect(msg2[0]).toBe('222');
      expect(msg2[1]).toContain('<b>Alice</b>');
    });

    it('dedupes reminders — second call within window is a no-op', async () => {
      mockLinkService.getChatIdsForUsers.mockResolvedValueOnce(
        new Map([['u1', '111']]),
      );
      const dup = new QueryFailedError('insert', [], new Error('dup') as unknown as string);
      (dup as unknown as { driverError: { code: string } }).driverError = { code: '23505' };
      repo.insert.mockRejectedValueOnce(dup);

      await service.notifyMatchReminder({
        tournamentId: 't1',
        matchId: 'm1',
        athleteUserIds: ['u1'],
        tableNumber: 3,
        minutesUntilStart: 14,
      });

      expect(mockTelegram.sendMessage).not.toHaveBeenCalled();
    });
  });
});
