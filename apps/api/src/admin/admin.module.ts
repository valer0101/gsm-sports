import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { UsersModule } from '../users/users.module';
import { BracketsModule } from '../brackets/brackets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tournament, TournamentOperator, WeightCategory, TournamentEntry]),
    TournamentsModule,
    UsersModule,
    BracketsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
