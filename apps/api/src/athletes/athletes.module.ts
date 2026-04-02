import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from './entities/athlete.entity';
import { AthletesService } from './athletes.service';
import { AthletesController } from './athletes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Athlete])],
  controllers: [AthletesController],
  providers: [AthletesService],
  exports: [AthletesService],
})
export class AthletesModule {}
