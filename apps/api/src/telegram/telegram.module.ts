import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramController } from './telegram.controller';
import { TelegramLink } from './entities/telegram-link.entity';

/**
 * Registers:
 *   - `TelegramService` — outbound sendMessage (PR #27)
 *   - `TelegramLinkService` — user ↔ chat binding via signed deep-links
 *   - `TelegramController` — athlete-facing link-token / unlink endpoints
 *
 * JwtModule is registered empty here — the link service reads the secret
 * at sign/verify time from env, same pattern as CheckInService (PR #15).
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([TelegramLink]),
  ],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramLinkService],
  exports: [TelegramService, TelegramLinkService],
})
export class TelegramModule {}
