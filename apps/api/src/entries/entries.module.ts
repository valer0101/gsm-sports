import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { TournamentEntry } from './entities/tournament-entry.entity';
import { User } from '../users/entities/user.entity';
import { EntriesService } from './entries.service';
import { EntriesController } from './entries.controller';
import { CheckInService } from './check-in.service';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TournamentEntry, User]),
    forwardRef(() => TournamentsModule),
    // Local JwtService instance for signing check-in QR tokens. The actual
    // secret is read from env at sign/verify time inside CheckInService so
    // this registration only satisfies Nest DI.
    ConfigModule,
    JwtModule.register({}),
  ],
  controllers: [EntriesController],
  providers: [EntriesService, CheckInService],
  exports: [EntriesService, CheckInService],
})
export class EntriesModule {}
