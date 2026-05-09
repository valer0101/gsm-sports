import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { SportsModule } from './sports/sports.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { EntriesModule } from './entries/entries.module';
import { BracketsModule } from './brackets/brackets.module';
import { AthletesModule } from './athletes/athletes.module';
import { RankingsModule } from './rankings/rankings.module';
import { EventsModule } from './events/events.module';
import { AdminModule } from './admin/admin.module';
import { OperatorModule } from './operator/operator.module';
import { UploadModule } from './upload/upload.module';
import { NewsModule } from './news/news.module';
import { MatchAssignmentsModule } from './match-assignments/match-assignments.module';
import { ScheduleModule } from './schedule/schedule.module';
import { TelegramModule } from './telegram/telegram.module';
import { WeighInsModule } from './weigh-ins/weigh-ins.module';
import { TeamStandingsModule } from './team-standings/team-standings.module';

@Module({
  imports: [
    // Environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>(
          'DATABASE_URL',
          'postgresql://gsm_user:gsm_dev_password@localhost:5432/gsm_sports',
        ),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') === 'development',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),

    // Cron / periodic tasks (MatchReminderTask in TelegramModule).
    NestScheduleModule.forRoot(),

    // Rate limiting — single global bucket: 100 req / minute / IP (mirrors
    // docs/04 spec). Tighter limits on brute-force-prone endpoints are applied
    // per-route via `@Throttle({ default: { ... } })` (see AuthController).
    //
    // We deliberately use a single throttler: in @nestjs/throttler v6 the
    // global ThrottlerGuard ANDs every entry of `throttlers: [...]` on every
    // request unless explicitly skipped via `@SkipThrottle({ name })`. A
    // second named bucket would silently apply to all routes — making the
    // tightest limit the effective one everywhere. Probes, polling, and
    // websocket handshakes would 429 within seconds. Per-route overrides
    // are the safer pattern.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    }),

    // Health probes — public, no auth required.
    HealthModule,

    // Feature modules
    AuthModule,
    UsersModule,
    SportsModule,
    TournamentsModule,
    EntriesModule,
    BracketsModule,
    AthletesModule,
    RankingsModule,
    EventsModule,
    AdminModule,
    OperatorModule,
    UploadModule,
    NewsModule,
    MatchAssignmentsModule,
    ScheduleModule,
    TelegramModule,
    WeighInsModule,
    TeamStandingsModule,
  ],
  providers: [
    // Global JWT guard — routes are protected by default; mark exceptions with @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global rate-limit guard — applies the default throttler to every
    // route; per-route `@Throttle({ default: { ... } })` overrides the
    // limit (e.g. AuthController tightens to 10 req / 15 min for brute-
    // force-prone login/register).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
