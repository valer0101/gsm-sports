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
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@ApiTags('Tournaments')
@Controller('v1/tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('sport') sport?: string,
    @Query('status') status?: string,
    @Query('country') country?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.tournamentsService.findAll({ sport, status, country, page, limit });
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.tournamentsService.findBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() dto: CreateTournamentDto, @Request() req: any) {
    return this.tournamentsService.create(dto, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTournamentDto, @Request() req: any) {
    return this.tournamentsService.update(id, dto, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Request() req: any,
  ) {
    return this.tournamentsService.updateStatus(id, dto.status, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/registration/toggle')
  toggleRegistration(@Param('id') id: string, @Request() req: any) {
    return this.tournamentsService.toggleRegistration(id, req.user.sub);
  }
}
