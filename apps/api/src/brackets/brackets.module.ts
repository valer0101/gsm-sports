import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bracket } from './entities/bracket.entity';
import { BracketsService } from './brackets.service';
import { BracketsController } from './brackets.controller';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { EntriesModule } from '../entries/entries.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bracket]),
    forwardRef(() => TournamentsModule),
    EntriesModule,
    EventsModule,
  ],
  controllers: [BracketsController],
  providers: [BracketsService],
  exports: [BracketsService],
})
export class BracketsModule {}
