import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchTableAssignment } from './entities/match-table-assignment.entity';
import { TournamentTable } from '../tournaments/entities/tournament-table.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { Bracket } from '../brackets/entities/bracket.entity';
import { MatchAssignmentsService } from './match-assignments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatchTableAssignment,
      TournamentTable,
      TournamentOperator,
      Bracket,
    ]),
  ],
  providers: [MatchAssignmentsService],
  exports: [MatchAssignmentsService],
})
export class MatchAssignmentsModule {}
