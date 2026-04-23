import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { EntriesService } from './entries.service';
import { CheckInService } from './check-in.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryStatusDto } from './dto/update-entry-status.dto';
import { EntryStatus } from './entities/tournament-entry.entity';
import { SetSeedNumbersDto } from './dto/set-seed-numbers.dto';
import { ReassignEntryDto } from './dto/reassign-entry.dto';
import { CheckInByQrDto } from './dto/check-in-by-qr.dto';

@ApiTags('Tournament Entries')
@Controller('v1/entries')
export class EntriesController {
  constructor(
    private readonly entriesService: EntriesService,
    private readonly checkInService: CheckInService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  register(@Body() dto: CreateEntryDto, @Request() req: any) {
    return this.entriesService.register(dto, req.user.sub);
  }

  @Get('tournament/:tournamentId')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'weightCategoryId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findByTournament(
    @Param('tournamentId') tournamentId: string,
    @Query('status') status?: EntryStatus,
    @Query('weightCategoryId') weightCategoryId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.entriesService.findByTournament(tournamentId, {
      status,
      weightCategoryId,
      page,
      limit,
    });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('my')
  findMyEntries(@Request() req: any) {
    return this.entriesService.findByUser(req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEntryStatusDto,
    @Request() req: any,
  ) {
    return this.entriesService.updateStatus(id, dto.status, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/withdraw')
  withdraw(@Param('id') id: string, @Request() req: any) {
    return this.entriesService.withdraw(id, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/reassign')
  reassign(@Param('id') id: string, @Body() dto: ReassignEntryDto, @Request() req: any) {
    return this.entriesService.reassign(
      id,
      {
        weightCategoryId: dto.weightCategoryId ?? undefined,
        ageGroup: dto.ageGroup,
        hand: dto.hand,
        weightKg: dto.weightKg,
        reason: dto.reason,
      },
      { userId: req.user.sub, roles: req.user.roles ?? [] },
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch('tournament/:tournamentId/seeds')
  setSeedNumbers(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: SetSeedNumbersDto,
    @Request() req: any,
  ) {
    return this.entriesService.setSeedNumbers(tournamentId, dto.seeds, req.user.sub);
  }

  // ─── Check-in ───────────────────────────────────────────────────────────

  @ApiOperation({
    summary: "Athlete: issue a signed QR token for venue check-in",
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get(':id/checkin-qr')
  issueCheckinQr(@Param('id') id: string, @Request() req: any) {
    return this.checkInService.issueQrToken(id, req.user.sub);
  }

  @ApiOperation({ summary: 'Admin / organizer: check-in via scanned QR token' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('check-in-by-qr')
  @HttpCode(HttpStatus.OK)
  checkInByQr(@Body() dto: CheckInByQrDto, @Request() req: any) {
    return this.checkInService.checkInByToken(dto.token, req.user.sub, req.user.roles ?? []);
  }

  @ApiOperation({ summary: 'Admin / organizer: manually check in an entry' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/check-in')
  @HttpCode(HttpStatus.OK)
  checkInManual(@Param('id') id: string, @Request() req: any) {
    return this.checkInService.checkInManual(id, req.user.sub, req.user.roles ?? []);
  }

  @ApiOperation({ summary: 'Admin: undo a previous check-in' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/undo-check-in')
  @HttpCode(HttpStatus.OK)
  undoCheckIn(@Param('id') id: string, @Request() req: any) {
    return this.checkInService.undoCheckIn(id, req.user.sub, req.user.roles ?? []);
  }
}
