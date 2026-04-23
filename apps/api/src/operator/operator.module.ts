import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorService } from './operator.service';
import { OperatorController } from './operator.controller';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { BracketsModule } from '../brackets/brackets.module';
import { MatchAssignmentsModule } from '../match-assignments/match-assignments.module';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { TournamentTable } from '../tournaments/entities/tournament-table.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TournamentOperator, TournamentTable, Tournament]),
    TournamentsModule,
    BracketsModule,
    MatchAssignmentsModule,
  ],
  controllers: [OperatorController],
  providers: [OperatorService],
})
export class OperatorModule {}
