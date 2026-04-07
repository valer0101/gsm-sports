import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { OperatorService } from './operator.service';
import { AuthGuard } from '@nestjs/passport';

class RecordResultDto {
  @IsString()
  matchId: string;

  @IsString()
  winnerId: string;
}

@ApiTags('operator')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
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
