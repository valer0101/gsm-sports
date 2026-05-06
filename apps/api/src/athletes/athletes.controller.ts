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
import { AthletesService } from './athletes.service';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Public } from '../auth/public.decorator';

@ApiTags('Athletes')
@Controller('v1/athletes')
export class AthletesController {
  constructor(private readonly athletesService: AthletesService) {}

  @Public()
  @Get()
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'gender', required: false })
  @ApiQuery({ name: 'hand', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('sport') sport?: string,
    @Query('country') country?: string,
    @Query('gender') gender?: string,
    @Query('hand') hand?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.athletesService.findAll({ sport, country, gender, hand, search, page, limit });
  }

  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.athletesService.findBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() dto: CreateAthleteDto, @Request() req: any) {
    return this.athletesService.create(dto, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAthleteDto, @Request() req: any) {
    return this.athletesService.update(id, dto, req.user.sub);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch(':id/verify')
  verify(@Param('id') id: string) {
    return this.athletesService.verify(id);
  }
}
