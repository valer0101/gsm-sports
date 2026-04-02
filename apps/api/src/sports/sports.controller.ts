import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SportsService } from './sports.service';
import { CreateSportDto } from './dto/create-sport.dto';
import { UpdateSportDto } from './dto/update-sport.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('Sports')
@Controller('v1/sports')
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.sportsService.findAll({ page, limit });
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.sportsService.findBySlug(slug);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  create(@Body() dto: CreateSportDto) {
    return this.sportsService.create(dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSportDto) {
    return this.sportsService.update(id, dto);
  }
}
