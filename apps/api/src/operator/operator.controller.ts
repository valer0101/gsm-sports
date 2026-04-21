import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OperatorService } from './operator.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RecordResultDto } from './dto/record-result.dto';

@ApiTags('operator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('operator', 'admin', 'organizer')
@Controller('v1/operator')
export class OperatorController {
  constructor(private readonly operatorService: OperatorService) {}

  @ApiOperation({ summary: 'List tournaments assigned to this operator' })
  @Get('tournaments')
  myTournaments(@Request() req: any) {
    return this.operatorService.myTournaments(req.user.sub);
  }

  @ApiOperation({ summary: 'Get all brackets for a tournament' })
  @Get('tournaments/:tournamentId/brackets')
  getBrackets(@Param('tournamentId') tournamentId: string, @Request() req: any) {
    return this.operatorService.getBrackets(tournamentId, req.user.sub);
  }

  @ApiOperation({ summary: 'Get all pending (playable) matches across all brackets' })
  @Get('tournaments/:tournamentId/pending-matches')
  getPendingMatches(@Param('tournamentId') tournamentId: string, @Request() req: any) {
    return this.operatorService.getPendingMatches(tournamentId, req.user.sub);
  }

  @ApiOperation({ summary: 'Record match result' })
  @Post('brackets/:bracketId/result')
  recordResult(
    @Param('bracketId') bracketId: string,
    @Body() dto: RecordResultDto,
    @Request() req: any,
  ) {
    return this.operatorService.recordResult(
      bracketId,
      dto.matchId,
      dto.winnerId,
      req.user.sub,
      dto.notes,
    );
  }
}
