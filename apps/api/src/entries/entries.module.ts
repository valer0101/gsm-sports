import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TournamentEntry } from './entities/tournament-entry.entity';
import { EntriesService } from './entries.service';
import { EntriesController } from './entries.controller';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [TypeOrmModule.forFeature([TournamentEntry]), forwardRef(() => TournamentsModule)],
  controllers: [EntriesController],
  providers: [EntriesService],
  exports: [EntriesService],
})
export class EntriesModule {}
