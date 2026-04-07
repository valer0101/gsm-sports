import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bracket } from './entities/bracket.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { BracketsService } from './brackets.service';
import { BracketsController } from './brackets.controller';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { EntriesModule } from '../entries/entries.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bracket, TournamentOperator]),
    TournamentsModule,
    EntriesModule,
    EventsModule,
  ],
  controllers: [BracketsController],
  providers: [BracketsService],
  exports: [BracketsService],
})
export class BracketsModule {}
