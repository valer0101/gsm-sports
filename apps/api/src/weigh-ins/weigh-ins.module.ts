import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeighIn } from './entities/weigh-in.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { WeighInsService } from './weigh-ins.service';
import { EntriesModule } from '../entries/entries.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeighIn, WeightCategory]),
    EntriesModule,
  ],
  providers: [WeighInsService],
  exports: [WeighInsService],
})
export class WeighInsModule {}
