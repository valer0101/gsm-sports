import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TeamStandingsService } from './team-standings.service';
import { Public } from '../auth/public.decorator';

@ApiTags('Team standings')
@Controller('v1/tournaments/:tournamentId/team-standings')
export class TeamStandingsController {
  constructor(private readonly teamStandingsService: TeamStandingsService) {}

  @ApiOperation({
    summary:
      'Country-level team leaderboard for a tournament — public (spectators / arena / federation displays)',
  })
  @Public()
  @Get()
  get(@Param('tournamentId') tournamentId: string) {
    return this.teamStandingsService.getForTournament(tournamentId);
  }
}
