import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BracketsService } from './brackets.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';

@ApiTags('Brackets')
@Controller('v1/brackets')
export class BracketsController {
  constructor(private readonly bracketsService: BracketsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('generate')
  generate(@Body() dto: GenerateBracketDto, @Request() req: any) {
    return this.bracketsService.generate(dto, req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bracketsService.findById(id);
  }

  @Get('tournament/:tournamentId')
  findByTournament(@Param('tournamentId') tournamentId: string) {
    return this.bracketsService.findByTournament(tournamentId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/result')
  recordResult(
    @Param('id') id: string,
    @Body() body: { matchId: string; winnerId: string },
    @Request() req: any,
  ) {
    return this.bracketsService.recordResult(id, body.matchId, body.winnerId, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/reset')
  reset(@Param('id') id: string, @Request() req: any) {
    return this.bracketsService.reset(id, req.user.sub);
  }
}
