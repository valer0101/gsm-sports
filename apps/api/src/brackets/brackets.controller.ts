import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BracketsService } from './brackets.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { ResetMatchDto } from './dto/reset-match.dto';
import { ReplacePlayerDto } from './dto/replace-player.dto';
import { WithdrawPlayerDto } from './dto/withdraw-player.dto';

@ApiTags('Brackets')
@Controller('v1/brackets')
export class BracketsController {
  constructor(private readonly bracketsService: BracketsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Generate bracket for a tournament (organizer only)' })
  @Post('generate')
  generate(@Body() dto: GenerateBracketDto, @Request() req: any) {
    return this.bracketsService.generate(dto, req.user.sub);
  }

  @ApiOperation({ summary: 'Get bracket by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bracketsService.findById(id);
  }

  @ApiOperation({ summary: 'Get all brackets for a tournament' })
  @Get('tournament/:tournamentId')
  findByTournament(@Param('tournamentId') tournamentId: string) {
    return this.bracketsService.findByTournament(tournamentId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Record or correct match result (organizer/operator/admin)' })
  @Patch(':id/result')
  recordResult(@Param('id') id: string, @Body() dto: RecordResultDto, @Request() req: any) {
    return this.bracketsService.recordResult(id, dto, req.user.sub, req.user.roles ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Reset a single match result (organizer/admin only)' })
  @Patch(':id/match-reset')
  resetMatch(@Param('id') id: string, @Body() dto: ResetMatchDto, @Request() req: any) {
    return this.bracketsService.resetSingleMatch(id, dto, req.user.sub, req.user.roles ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Replace a player in a match slot (organizer/admin only)' })
  @Patch(':id/matches/:matchId/replace-player')
  replacePlayer(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: ReplacePlayerDto,
    @Request() req: any,
  ) {
    return this.bracketsService.replacePlayer(id, matchId, dto, req.user.sub, req.user.roles ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Withdraw a player from a pending match; opponent gets forfeit (organizer/operator/admin)',
  })
  @Patch(':id/matches/:matchId/withdraw-player')
  withdrawPlayer(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: WithdrawPlayerDto,
    @Request() req: any,
  ) {
    return this.bracketsService.withdrawPlayer(id, matchId, dto, req.user.sub, req.user.roles ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Reset entire bracket (organizer/admin only)' })
  @Patch(':id/reset')
  reset(@Param('id') id: string, @Request() req: any) {
    return this.bracketsService.reset(id, req.user.sub, req.user.roles ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Lock bracket — only admin can change results after lock' })
  @Patch(':id/lock')
  lock(@Param('id') id: string, @Request() req: any) {
    return this.bracketsService.setLocked(id, true, req.user.sub, req.user.roles ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Unlock bracket' })
  @Patch(':id/unlock')
  unlock(@Param('id') id: string, @Request() req: any) {
    return this.bracketsService.setLocked(id, false, req.user.sub, req.user.roles ?? []);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get audit log of all changes (organizer/operator/admin only)',
  })
  @Get(':id/audit')
  getAudit(@Param('id') id: string, @Request() req: any) {
    return this.bracketsService.getAuditLog(id, req.user.sub, req.user.roles ?? []);
  }
}
