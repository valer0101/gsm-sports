import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';

/**
 * Thin module — just registers `TelegramService` and ensures
 * `ConfigService` is available for it to read `TELEGRAM_BOT_TOKEN`.
 * Exported so feature modules (brackets, scheduler) can inject the
 * service to send notifications.
 */
@Module({
  imports: [ConfigModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
