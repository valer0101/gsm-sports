import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';
import { MatchNotification } from './entities/match-notification.entity';

export type NotificationKind = 'opponent_withdrew' | 'reminder_15m';

/**
 * Per-match Telegram notifications — "opponent withdrew, you advance" and
 * "your match in ~15 min, table N". Two callers:
 *
 *   - `BracketsService.withdrawPlayer` pushes opponent-withdrew inline
 *     after the forfeit commits.
 *   - `MatchReminderTask` (cron) walks the live schedule every minute
 *     and fires reminders for matches in the 15-min window.
 *
 * Dedupe is at the DB layer via a UNIQUE (tournament, match, kind)
 * constraint — the sender tries to INSERT the notification row first; if
 * the row already exists (conflict), the send is skipped silently. That
 * way the reminder cron can retry safely and crashes mid-send don't
 * double-message the athlete on the next tick.
 *
 * All send paths swallow Telegram errors. A bot outage must not block
 * bracket state changes or the cron loop.
 */
@Injectable()
export class TelegramNotificationsService {
  private logger = new Logger(TelegramNotificationsService.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly linkService: TelegramLinkService,
    @InjectRepository(MatchNotification)
    private readonly notificationsRepository: Repository<MatchNotification>,
  ) {}

  /**
   * Notify an athlete that their opponent withdrew and they advance. The
   * caller already knows the "winner by forfeit" user id — pass it here
   * so we don't have to recompute.
   *
   * `kindSuffix` is appended to the dedupe key so a double-withdraw into
   * the same match (e.g. correction flow) can still notify the new
   * winner. Keep it stable per call site.
   */
  async notifyOpponentWithdrew(params: {
    tournamentId: string;
    matchId: string;
    winnerUserId: string;
    withdrawnPlayerName: string;
    /** e.g. "Men 80kg · right hand" for context in the message body. */
    categoryLabel?: string | null;
  }): Promise<void> {
    const { tournamentId, matchId, winnerUserId, withdrawnPlayerName, categoryLabel } = params;

    const chatId = await this.linkService.getChatId(winnerUserId);
    if (!chatId) return; // athlete didn't link Telegram — silent skip

    const sent = await this.tryRecord(tournamentId, matchId, 'opponent_withdrew');
    if (!sent) return; // already notified for this (match, kind)

    const catLine = categoryLabel ? `\n<b>${escapeHtml(categoryLabel)}</b>` : '';
    const text =
      `⚠️ Ваш соперник ${escapeHtml(withdrawnPlayerName)} снялся.\n` +
      `Вы автоматически проходите в следующий раунд.${catLine}`;

    try {
      await this.telegram.sendMessage(chatId, text);
    } catch (err) {
      this.logger.warn(
        `opponent_withdrew send failed for match ${matchId}: ${(err as Error)?.message ?? 'unknown'}`,
      );
    }
  }

  /**
   * Notify BOTH athletes of a match that their bout is coming up. Caller
   * supplies both user ids (either may be absent if unlinked) and human-
   * readable match context.
   */
  async notifyMatchReminder(params: {
    tournamentId: string;
    matchId: string;
    athleteUserIds: string[];
    tableNumber: number;
    minutesUntilStart: number;
    categoryLabel?: string | null;
    opponentNames?: Record<string, string>;
  }): Promise<void> {
    const {
      tournamentId,
      matchId,
      athleteUserIds,
      tableNumber,
      minutesUntilStart,
      categoryLabel,
      opponentNames,
    } = params;

    const chatIds = await this.linkService.getChatIdsForUsers(athleteUserIds);
    if (chatIds.size === 0) return;

    const sent = await this.tryRecord(tournamentId, matchId, 'reminder_15m');
    if (!sent) return;

    const catLine = categoryLabel ? `\n<b>${escapeHtml(categoryLabel)}</b>` : '';

    for (const userId of athleteUserIds) {
      const chatId = chatIds.get(userId);
      if (!chatId) continue;
      const opponentName = opponentNames?.[userId];
      const opponentLine = opponentName ? `\nСоперник: <b>${escapeHtml(opponentName)}</b>` : '';
      const text =
        `🔔 Ваш матч через ~${minutesUntilStart} мин, стол №${tableNumber}.` +
        `${opponentLine}${catLine}`;

      try {
        await this.telegram.sendMessage(chatId, text);
      } catch (err) {
        this.logger.warn(
          `reminder_15m send failed for user ${userId}, match ${matchId}: ${(err as Error)?.message ?? 'unknown'}`,
        );
      }
    }
  }

  /**
   * Insert a dedupe row. Returns true if the row was created (caller
   * should proceed to send), false on UNIQUE-constraint violation
   * (already notified — caller skips). Any other DB error is logged and
   * treated as "don't send" — a bot outage must not corrupt tournament
   * state.
   */
  private async tryRecord(
    tournamentId: string,
    matchId: string,
    kind: NotificationKind,
  ): Promise<boolean> {
    try {
      await this.notificationsRepository.insert({
        tournamentId,
        matchId,
        kind,
      });
      return true;
    } catch (err) {
      // Postgres unique_violation = '23505'. TypeORM wraps it in
      // QueryFailedError. Anything else — log and err on the side of
      // not-sending.
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === '23505'
      ) {
        this.logger.debug(
          `skip ${kind} for match ${matchId} — already recorded`,
        );
        return false;
      }
      this.logger.warn(
        `failed to record ${kind} for match ${matchId}: ${(err as Error)?.message ?? 'unknown'}`,
      );
      return false;
    }
  }
}

/**
 * Minimal HTML escape for Telegram `parse_mode: 'HTML'`. Telegram only
 * interprets `<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`, and `<a>`
 * — but ANY `<` or `&` in user-supplied text (athlete name, category
 * label from organizer) would either break the parser or render wrong.
 * Escape the three critical characters.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
