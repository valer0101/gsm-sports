import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bracket } from './entities/bracket.entity';
import { BracketAuditLog } from './entities/bracket-audit-log.entity';
import { BracketsService } from './brackets.service';
import { BracketsController } from './brackets.controller';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { EntriesModule } from '../entries/entries.module';
import { EventsModule } from '../events/events.module';
import { MatchAssignmentsModule } from '../match-assignments/match-assignments.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bracket, BracketAuditLog, TournamentOperator]),
    forwardRef(() => TournamentsModule),
    EntriesModule,
    EventsModule,
    MatchAssignmentsModule,
    TelegramModule,
  ],
  controllers: [BracketsController],
  providers: [BracketsService],
  exports: [BracketsService],
})
export class BracketsModule {}
