import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './users/entities/user.entity';
import { Sport } from './sports/entities/sport.entity';
import { Tournament } from './tournaments/entities/tournament.entity';
import { WeightCategory } from './tournaments/entities/weight-category.entity';
import { TournamentOperator } from './tournaments/entities/tournament-operator.entity';
import { TournamentTable } from './tournaments/entities/tournament-table.entity';
import { MatchTableAssignment } from './match-assignments/entities/match-table-assignment.entity';
import { TelegramLink } from './telegram/entities/telegram-link.entity';
import { MatchNotification } from './telegram/entities/match-notification.entity';
import { TournamentEntry } from './entries/entities/tournament-entry.entity';
import { Bracket } from './brackets/entities/bracket.entity';
import { Athlete } from './athletes/entities/athlete.entity';
import { RankingEntry } from './rankings/entities/ranking-entry.entity';
import { News } from './news/entities/news.entity';
import { PasswordResetToken } from './auth/entities/password-reset-token.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url:
    process.env['DATABASE_URL'] ??
    'postgresql://gsm_user:gsm_dev_password@localhost:5432/gsm_sports',
  entities: [
    User,
    Sport,
    Tournament,
    WeightCategory,
    TournamentOperator,
    TournamentTable,
    MatchTableAssignment,
    TournamentEntry,
    Bracket,
    Athlete,
    RankingEntry,
    News,
    PasswordResetToken,
    TelegramLink,
    MatchNotification,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});
