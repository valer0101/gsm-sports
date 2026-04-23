import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
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
  ],
  providers: [
    // Global JWT guard — routes are protected by default; mark exceptions with @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
