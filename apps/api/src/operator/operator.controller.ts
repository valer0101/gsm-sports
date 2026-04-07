import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OperatorService } from './operator.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RecordResultDto } from './dto/record-result.dto';

@ApiTags('operator')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('operator', 'admin', 'organizer')
@Controller('v1/operator')
export class OperatorController {
  constructor(private readonly operatorService: OperatorService) {}

  @Get('tournaments')
  myTournaments(@Request() req: any) {
    return this.operatorService.myTournaments(req.user.sub);
  }

  @Get('tournaments/:tournamentId/brackets')
  getBrackets(@Param('tournamentId') tournamentId: string, @Request() req: any) {
    return this.operatorService.getBrackets(tournamentId, req.user.sub);
  }

  @Post('brackets/:bracketId/result')
  recordResult(
    @Param('bracketId') bracketId: string,
    @Body() dto: RecordResultDto,
    @Request() req: any,
  ) {
    return this.operatorService.recordResult(bracketId, dto.matchId, dto.winnerId, req.user.sub);
  }
}
