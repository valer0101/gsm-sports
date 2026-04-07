import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { User } from '../users/entities/user.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { BracketsModule } from '../brackets/brackets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tournament,
      TournamentOperator,
      WeightCategory,
      User,
      TournamentEntry,
    ]),
    BracketsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
