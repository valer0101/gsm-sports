import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Result of `sendMessage`. The `sent` flag distinguishes an actual API
 * call from stub-mode (no token configured → we logged instead). Callers
 * that persist outgoing-message audit rows can key on `sent` to decide
 * whether to retry later.
 */
export interface SendMessageResult {
  sent: boolean;
  chatId: string | number;
  /** `null` when `sent === false` (stub mode or Telegram gave no id). */
  messageId: number | null;
}

/**
 * Minimal Telegram Bot API client for outbound notifications.
 *
 * Why no SDK: the Bot API is plain HTTP-JSON and we only need one method
 * here (`sendMessage`). Pulling in `grammy` / `node-telegram-bot-api`
 * would add a transitive dep tree + its own event loop for features we
 * don't use. Direct `fetch` keeps the surface small and typed.
 *
 * Stub mode: if `TELEGRAM_BOT_TOKEN` is unset, the service still
 * "accepts" `sendMessage` calls — it just logs the intended payload and
 * returns `{ sent: false }`. That way:
 *   - the codebase stays runnable in environments without a bot (CI,
 *     local dev for devs who don't touch notifications),
 *   - flipping the feature on is a single env-var change,
 *   - integration callers don't need their own feature flag.
 */
@Injectable()
export class TelegramService {
  private logger = new Logger(TelegramService.name);
  private readonly botToken: string | null;
  private readonly apiBase: string;

  constructor(config: ConfigService) {
    const token = config.get<string>('TELEGRAM_BOT_TOKEN');
    this.botToken = token && token.length > 10 ? token : null;
    // Injection-resistant base — built once, never concatenates user input.
    this.apiBase = this.botToken ? `https://api.telegram.org/bot${this.botToken}` : '';

    if (!this.botToken) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN not set — Telegram notifications will be logged, not sent',
      );
    }
  }

  /** True iff an actual bot token is configured. */
  isConfigured(): boolean {
    return this.botToken !== null;
  }

  /**
   * Send a plain-text message. `chatId` is whatever Telegram assigned to
   * the target chat (stored per user in `telegram_links` once that PR
   * lands). Caller is responsible for having chatId → user mapping.
   *
   * Failures on the network path throw so the caller can retry / log;
   * stub mode never throws.
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options: { disableNotification?: boolean } = {},
  ): Promise<SendMessageResult> {
    if (!this.botToken) {
      // Stub: log what we WOULD send. Truncate text so giant templates
      // don't blow up the log line.
      const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text;
      this.logger.log(`[telegram-stub] chat=${chatId} text=${preview}`);
      return { sent: false, chatId, messageId: null };
    }

    const res = await fetch(`${this.apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_notification: options.disableNotification ?? false,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(
        `Telegram sendMessage failed (${res.status}): ${bodyText.slice(0, 200)}`,
      );
    }

    const body = (await res.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };
    if (!body.ok) {
      throw new Error(`Telegram sendMessage rejected: ${body.description ?? 'unknown'}`);
    }

    return {
      sent: true,
      chatId,
      messageId: body.result?.message_id ?? null,
    };
  }
}
