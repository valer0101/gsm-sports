import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RankingsService } from './rankings.service';
import { UpsertRankingDto } from './dto/upsert-ranking.dto';
import { RecalculateRankingDto } from './dto/recalculate-ranking.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('Rankings')
@Controller('v1/rankings')
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get('world')
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'sportId', required: false })
  @ApiQuery({ name: 'season', required: false, type: Number })
  @ApiQuery({ name: 'hand', required: false })
  @ApiQuery({ name: 'gender', required: false })
  @ApiQuery({ name: 'weightCategory', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findWorldRankings(
    @Query('sport') sport?: string,
    @Query('sportId') sportId?: string,
    @Query('season') season?: number,
    @Query('hand') hand?: string,
    @Query('gender') gender?: string,
    @Query('weightCategory') weightCategory?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.rankingsService.findWorldRankings({
      sport,
      sportId,
      season,
      hand,
      gender,
      weightCategory,
      page,
      limit,
    });
  }

  @Get('country/:country')
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'season', required: false, type: Number })
  @ApiQuery({ name: 'hand', required: false })
  @ApiQuery({ name: 'gender', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findCountryRankings(
    @Param('country') country: string,
    @Query('sport') sport?: string,
    @Query('season') season?: number,
    @Query('hand') hand?: string,
    @Query('gender') gender?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.rankingsService.findCountryRankings(country, {
      sport,
      season,
      hand,
      gender,
      page,
      limit,
    });
  }

  @Get('athlete/:athleteId')
  @ApiQuery({ name: 'season', required: false, type: Number })
  findByAthlete(@Param('athleteId') athleteId: string, @Query('season') season?: number) {
    return this.rankingsService.findByAthlete(athleteId, season);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  upsert(@Body() dto: UpsertRankingDto) {
    return this.rankingsService.upsert(dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('recalculate')
  recalculate(@Body() dto: RecalculateRankingDto) {
    return this.rankingsService.recalculate(dto.sportId, dto.season);
  }
}
