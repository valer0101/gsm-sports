import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from './entities/tournament.entity';
import { WeightCategory } from './entities/weight-category.entity';
import { TournamentOperator } from './entities/tournament-operator.entity';
import { TournamentTable } from './entities/tournament-table.entity';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { BracketsModule } from '../brackets/brackets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tournament, WeightCategory, TournamentOperator, TournamentTable]),
    forwardRef(() => BracketsModule),
  ],
  controllers: [TournamentsController, TablesController],
  providers: [TournamentsService, TablesService],
  exports: [TournamentsService, TablesService],
})
export class TournamentsModule {}
