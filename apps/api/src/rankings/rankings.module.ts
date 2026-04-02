import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RankingEntry } from './entities/ranking-entry.entity';
import { RankingsService } from './rankings.service';
import { RankingsController } from './rankings.controller';
import { AthletesModule } from '../athletes/athletes.module';

@Module({
  imports: [TypeOrmModule.forFeature([RankingEntry]), AthletesModule],
  controllers: [RankingsController],
  providers: [RankingsService],
  exports: [RankingsService],
})
export class RankingsModule {}
