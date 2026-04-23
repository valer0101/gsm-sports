import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TelegramLink } from './entities/telegram-link.entity';

export interface LinkTokenPayload {
  token: string;
  /** Deep-link URL the athlete opens in Telegram. */
  deepLink: string;
  /** ISO timestamp — token valid until this moment. */
  expiresAt: string;
}

/**
 * Lifecycle of the GSM-user ↔ Telegram-chat binding:
 *
 *   1. Athlete calls `issueLinkToken(userId)` → gets a short-lived signed
 *      JWT and a `https://t.me/<BOT>?start=<token>` deep-link.
 *   2. Athlete opens the deep-link in Telegram; the bot receives
 *      `/start <token>` from their chat.
 *   3. PR-T3's ingestion layer (webhook or polling) calls
 *      `completeLink(token, chatId)` which verifies the JWT + stores the
 *      binding. Upserts — re-linking from a new phone overwrites the
 *      previous `chat_id`.
 *   4. Athlete can later call `unlink(userId)` to stop notifications.
 *
 * The token is signed with a dedicated secret (falls back to
 * `JWT_ACCESS_SECRET + '-telegram'` in dev, mandatory in production) so a
 * leaked deep-link can't be replayed as a session token. TTL is 15
 * minutes — long enough for the athlete to tap the link, short enough
 * that a shared screenshot is useless.
 */
@Injectable()
export class TelegramLinkService {
  private logger = new Logger(TelegramLinkService.name);
  private readonly linkSecret: string;
  private readonly botUsername: string | null;
  /** 15 minutes — see class docstring. */
  private readonly tokenTtlSeconds = 15 * 60;

  constructor(
    @InjectRepository(TelegramLink)
    private readonly linksRepository: Repository<TelegramLink>,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    const explicit = config.get<string>('JWT_TELEGRAM_LINK_SECRET');
    const nodeEnv = config.get<string>('NODE_ENV') ?? process.env.NODE_ENV;

    if (!explicit && nodeEnv === 'production') {
      throw new Error(
        'JWT_TELEGRAM_LINK_SECRET must be set in production (dev falls back to JWT_ACCESS_SECRET)',
      );
    }

    const access = config.get<string>(
      'JWT_ACCESS_SECRET',
      'dev-access-secret-change-in-prod',
    );
    this.linkSecret = explicit ?? `${access}-telegram`;
    this.botUsername = config.get<string>('TELEGRAM_BOT_USERNAME') ?? null;
  }

  /**
   * Athlete asks for a link deep-URL. They must be authenticated; the
   * endpoint layer guarantees that. Returns the signed token + a
   * Telegram deep-link the UI can render as a button.
   */
  async issueLinkToken(userId: string): Promise<LinkTokenPayload> {
    if (!this.botUsername) {
      throw new BadRequestException(
        'Telegram bot is not configured — set TELEGRAM_BOT_USERNAME in the environment',
      );
    }

    const expiresAt = new Date(Date.now() + this.tokenTtlSeconds * 1000);
    const token = this.jwtService.sign(
      { userId, purpose: 'telegram-link' },
      { secret: this.linkSecret, expiresIn: this.tokenTtlSeconds },
    );
    // t.me deep-links accept a short `start` payload — they URL-decode
    // and pass it to the bot as the first argument to `/start`.
    const deepLink = `https://t.me/${this.botUsername}?start=${encodeURIComponent(token)}`;

    return { token, deepLink, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Ingestion layer (webhook / polling) calls this when it sees
   * `/start <token>` from a Telegram chat. Verifies the token + purpose
   * claim + expiry, then upserts the (user, chatId) binding.
   */
  async completeLink(token: string, chatId: string | number): Promise<TelegramLink> {
    let payload: { userId?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token, { secret: this.linkSecret });
    } catch {
      throw new UnauthorizedException('Telegram link token is invalid or expired');
    }
    if (payload.purpose !== 'telegram-link' || !payload.userId) {
      throw new UnauthorizedException('Telegram link token has wrong shape');
    }

    const chatIdStr = String(chatId);
    const existing = await this.linksRepository.findOne({
      where: { userId: payload.userId },
    });
    if (existing) {
      existing.chatId = chatIdStr;
      const saved = await this.linksRepository.save(existing);
      this.logger.log(`Telegram link updated for user ${payload.userId}`);
      return saved;
    }

    const link = this.linksRepository.create({
      userId: payload.userId,
      chatId: chatIdStr,
    });
    const saved = await this.linksRepository.save(link);
    this.logger.log(`Telegram link created for user ${payload.userId}`);
    return saved;
  }

  /** Athlete stops receiving notifications. Idempotent on missing link. */
  async unlink(userId: string): Promise<void> {
    const link = await this.linksRepository.findOne({ where: { userId } });
    if (!link) return;
    await this.linksRepository.remove(link);
    this.logger.log(`Telegram link removed for user ${userId}`);
  }

  /** Current link (if any) — used by the UI to show "connected as ..." state. */
  async findByUser(userId: string): Promise<TelegramLink | null> {
    return this.linksRepository.findOne({ where: { userId } });
  }

  /**
   * Used by notification senders — "given this user, where do I message?".
   * Null when not linked; callers should treat that as "skip quietly".
   */
  async getChatId(userId: string): Promise<string | null> {
    const link = await this.linksRepository.findOne({ where: { userId } });
    return link?.chatId ?? null;
  }

  /**
   * Bulk-fetch chat ids for a list of users. Used by broadcasts (e.g.
   * "check-in is open") to avoid N+1.
   */
  async getChatIdsForUsers(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const links = await this.linksRepository
      .createQueryBuilder('l')
      .where('l.userId IN (:...ids)', { ids: userIds })
      .getMany();
    return new Map(links.map((l) => [l.userId, l.chatId]));
  }
}
