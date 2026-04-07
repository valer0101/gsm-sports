import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from './entities/tournament.entity';
import { WeightCategory } from './entities/weight-category.entity';
import { TournamentOperator } from './entities/tournament-operator.entity';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { BracketsModule } from '../brackets/brackets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tournament, WeightCategory, TournamentOperator]),
    forwardRef(() => BracketsModule),
  ],
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService, TypeOrmModule],
})
export class TournamentsModule {}
