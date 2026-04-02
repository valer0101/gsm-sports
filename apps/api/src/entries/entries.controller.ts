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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { EntriesService } from './entries.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryStatusDto } from './dto/update-entry-status.dto';
import { SetSeedNumbersDto } from './dto/set-seed-numbers.dto';

@ApiTags('Tournament Entries')
@Controller('v1/entries')
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

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
    @Query('status') status?: string,
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
  @Patch('tournament/:tournamentId/seeds')
  setSeedNumbers(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: SetSeedNumbersDto,
    @Request() req: any,
  ) {
    return this.entriesService.setSeedNumbers(tournamentId, dto.seeds, req.user.sub);
  }
}
