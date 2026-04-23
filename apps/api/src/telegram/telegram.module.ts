import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramUpdateService } from './telegram-update.service';
import { TelegramNotificationsService } from './telegram-notifications.service';
import { MatchReminderTask } from './match-reminder.task';
import { TelegramController } from './telegram.controller';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramLink } from './entities/telegram-link.entity';
import { MatchNotification } from './entities/match-notification.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Bracket } from '../brackets/entities/bracket.entity';
import { TournamentTable } from '../tournaments/entities/tournament-table.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { ScheduleModule } from '../schedule/schedule.module';

/**
 * Registers:
 *   - `TelegramService` — outbound sendMessage + setWebhook (PR #27)
 *   - `TelegramLinkService` — user ↔ chat binding via signed deep-links
 *     (PR #28)
 *   - `TelegramUpdateService` — dispatcher for incoming Bot API updates
 *   - `TelegramController` — athlete-facing link-token / unlink endpoints +
 *     admin set-webhook
 *   - `TelegramWebhookController` — public POST /webhook entry point
 *     (secret-token header verified)
 *
 * JwtModule is registered empty here — the link service reads the secret
 * at sign/verify time from env, same pattern as CheckInService (PR #15).
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      TelegramLink,
      MatchNotification,
      Tournament,
      Bracket,
      TournamentTable,
      TournamentEntry,
    ]),
    ScheduleModule,
  ],
  controllers: [TelegramController, TelegramWebhookController],
  providers: [
    TelegramService,
    TelegramLinkService,
    TelegramUpdateService,
    TelegramNotificationsService,
    MatchReminderTask,
  ],
  exports: [TelegramService, TelegramLinkService, TelegramNotificationsService],
})
export class TelegramModule {}
