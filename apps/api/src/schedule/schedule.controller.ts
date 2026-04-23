import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import { Public } from '../auth/public.decorator';

@ApiTags('Schedule')
@Controller('v1/tournaments/:tournamentId/schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @ApiOperation({
    summary:
      'Current match schedule with ETA per table — public (for arena displays and spectators)',
  })
  @Public()
  @Get()
  get(@Param('tournamentId') tournamentId: string) {
    return this.scheduleService.getForTournament(tournamentId);
  }
}
