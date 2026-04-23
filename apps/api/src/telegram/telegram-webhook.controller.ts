import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/public.decorator';
import { TelegramUpdateService, type TelegramUpdate } from './telegram-update.service';

/** Constant-time string compare. Returns false for any length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * The single entry point for incoming Telegram updates.
 *
 * `@Public()` because Telegram's webhook POST has no bearer token — the
 * authenticity check is the `X-Telegram-Bot-Api-Secret-Token` header,
 * which Telegram echoes from the secret we set when calling `setWebhook`.
 * Mismatch → 401 (generic to avoid leaking timing info).
 *
 * Responds 200 as fast as possible. `handleUpdate` is contractually
 * non-throwing; any real work failure is logged inside the dispatcher
 * rather than bubbling up and triggering Telegram's retry loop.
 */
@ApiTags('Telegram')
@Controller('v1/telegram')
export class TelegramWebhookController {
  constructor(
    private readonly updateService: TelegramUpdateService,
    private readonly config: ConfigService,
  ) {}

  @ApiExcludeEndpoint() // internal Telegram endpoint, not for end users
  @ApiOperation({ summary: 'Telegram Bot API webhook — do not call manually' })
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') receivedSecret: string | undefined,
    @Body() update: TelegramUpdate,
  ): Promise<{ ok: true }> {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    // Refuse to accept updates if the secret isn't configured — safer than
    // silently running open. Telegram will keep retrying, giving ops a
    // loud signal that the deploy is mis-configured.
    if (!expected) {
      throw new UnauthorizedException('Webhook not configured');
    }
    // Constant-time compare so a remote attacker can't byte-walk the
    // secret through response-timing side channels. Generic 401
    // message on any mismatch keeps the error shape uniform.
    if (typeof receivedSecret !== 'string' || !safeEqual(receivedSecret, expected)) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    await this.updateService.handleUpdate(update);
    return { ok: true };
  }
}
