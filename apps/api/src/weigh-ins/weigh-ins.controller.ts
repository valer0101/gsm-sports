import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WeighInsService } from './weigh-ins.service';
import { RecordWeighInDto } from './dto/record-weigh-in.dto';

/**
 * HTTP surface for weigh-ins (Phase 3.1).
 *
 * All endpoints require a bearer token — even the read endpoints, because
 * measured weights are personal data the athlete hasn't consented to
 * publish. The service layer does the admin/organizer role check per call.
 */
@ApiTags('Weigh-ins')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('v1/weigh-ins')
export class WeighInsController {
  constructor(private readonly weighInsService: WeighInsService) {}

  @Post()
  @ApiOperation({ summary: 'Record (or overwrite) an entry\'s official weigh-in' })
  record(@Body() dto: RecordWeighInDto, @Request() req: any) {
    return this.weighInsService.record(dto.entryId, dto.officialWeightKg, {
      userId: req.user.sub,
      roles: req.user.roles ?? [],
    });
  }

  @Get('tournament/:tournamentId')
  @ApiOperation({ summary: 'List weigh-ins for a tournament' })
  findByTournament(@Param('tournamentId') tournamentId: string) {
    return this.weighInsService.findByTournamentId(tournamentId);
  }

  @Get('entry/:entryId')
  @ApiOperation({ summary: 'Get the weigh-in for a specific entry (null if none)' })
  findByEntry(@Param('entryId') entryId: string) {
    return this.weighInsService.findByEntryId(entryId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Undo a weigh-in (admin only)' })
  async undo(@Param('id') id: string, @Request() req: any) {
    await this.weighInsService.undo(id, {
      userId: req.user.sub,
      roles: req.user.roles ?? [],
    });
  }
}
