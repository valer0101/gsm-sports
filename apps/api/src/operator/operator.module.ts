import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorService } from './operator.service';
import { OperatorController } from './operator.controller';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { BracketsModule } from '../brackets/brackets.module';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TournamentOperator, Tournament]),
    TournamentsModule,
    BracketsModule,
  ],
  controllers: [OperatorController],
  providers: [OperatorService],
})
export class OperatorModule {}
