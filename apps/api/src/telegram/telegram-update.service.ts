import { Injectable, Logger } from '@nestjs/common';
import { TelegramLinkService } from './telegram-link.service';

/**
 * Shape of the Telegram `Update` object we care about. Bot API sends many
 * variants (`edited_message`, `callback_query`, `inline_query`, …); v1
 * only handles `message` with text. Unknown variants are silently ignored
 * so the webhook keeps returning 200 and Telegram stops retrying.
 *
 * Docs: https://core.telegram.org/bots/api#update
 */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number | string; type?: string };
    from?: { id: number | string; username?: string };
    date?: number;
    text?: string;
  };
  // Other fields accepted but ignored.
  [key: string]: unknown;
}

/**
 * Dispatcher for incoming Telegram updates. Called by the webhook
 * controller (the only entry point under the webhook-only model chosen
 * for Phase 2.4).
 *
 * Runtime contract: MUST NOT throw — any thrown error would bubble to
 * the controller, which would return 5xx and Telegram would keep
 * retrying the same update. Failures are logged and swallowed; we owe
 * Telegram a 200 for any well-formed request.
 */
@Injectable()
export class TelegramUpdateService {
  private logger = new Logger(TelegramUpdateService.name);

  constructor(private readonly linkService: TelegramLinkService) {}

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    // Top-level catch to honour the MUST-NOT-throw contract: if the
    // update shape lies about its types (e.g. `text` isn't actually a
    // string), any sync operation below could throw and we'd bubble 5xx
    // to Telegram, triggering its retry loop. Log + swallow instead.
    try {
      const message = update.message;
      if (!message || typeof message.text !== 'string') return;

      const text = message.text.trim();
      // Handle the only command we care about for v1: /start <token>
      // issued when the athlete taps the deep-link from their profile.
      const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/);
      if (startMatch) {
        const token = startMatch[1];
        if (!token) {
          this.logger.debug(`/start without token from chat ${message.chat.id} — ignoring`);
          return;
        }
        try {
          await this.linkService.completeLink(token, message.chat.id);
          this.logger.log(`Completed Telegram link for chat ${message.chat.id}`);
        } catch (err) {
          // Deep-link expired, wrong purpose, or user already linked with
          // a different token — log and move on. Telegram is not the
          // right channel to explain why; the web UI covers that.
          const errMsg = (err as Error)?.message ?? 'unknown';
          this.logger.warn(
            `Telegram link completion failed for chat ${message.chat.id}: ${errMsg}`,
          );
        }
        return;
      }

      // Other text messages are unrecognised for now. Logged at debug so
      // prod doesn't spam — future commands (e.g. /unlink, /help) get
      // added here.
      this.logger.debug(
        `Unhandled Telegram message from chat ${message.chat.id}: ${text.slice(0, 80)}`,
      );
    } catch (err) {
      this.logger.error(
        `Unexpected error while handling Telegram update ${update.update_id}: ${(err as Error)?.message ?? 'unknown'}`,
      );
    }
  }
}
