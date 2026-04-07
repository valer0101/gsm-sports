import { Module } from '@nestjs/common';
import { OperatorService } from './operator.service';
import { OperatorController } from './operator.controller';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { BracketsModule } from '../brackets/brackets.module';

@Module({
  imports: [TournamentsModule, BracketsModule],
  controllers: [OperatorController],
  providers: [OperatorService],
})
export class OperatorModule {}
