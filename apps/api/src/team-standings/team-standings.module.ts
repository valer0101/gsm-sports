import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Bracket } from '../brackets/entities/bracket.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { TeamStandingsService } from './team-standings.service';
import { TeamStandingsController } from './team-standings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tournament, Bracket, TournamentEntry])],
  controllers: [TeamStandingsController],
  providers: [TeamStandingsService],
  exports: [TeamStandingsService],
})
export class TeamStandingsModule {}
