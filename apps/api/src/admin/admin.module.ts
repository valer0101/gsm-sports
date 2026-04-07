import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { UsersModule } from '../users/users.module';
import { BracketsModule } from '../brackets/brackets.module';

@Module({
  imports: [
    // TournamentEntry is needed for direct query operations in AdminService
    TypeOrmModule.forFeature([TournamentEntry]),
    TournamentsModule,
    UsersModule,
    BracketsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
