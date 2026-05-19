import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsEnum, IsNumber, Min, Max, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { Public } from '../auth/public.decorator';
import { AgeGroup } from '../entries/entities/tournament-entry.entity';

class RegisterParticipantDto {
  @ApiProperty({ enum: ['juniors', 'adults', 'veterans'] })
  @IsEnum(['juniors', 'adults', 'veterans'])
  ageGroup: AgeGroup;

  @ApiProperty({ enum: ['left', 'right'] })
  @IsEnum(['left', 'right'])
  hand: string;

  @ApiProperty({ example: 75.5 })
  @IsNumber()
  @Min(20)
  @Max(300)
  weightKg: number;

  @ApiProperty({ example: 'weight-category-uuid', required: false })
  @IsOptional()
  @IsUUID()
  weightCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

class AssignOperatorDto {
  @ApiProperty({ example: 'user-uuid-here' })
  @IsString()
  operatorId: string;

  @ApiProperty({
    example: 'table-uuid-here',
    required: false,
    description: 'Optional table assignment. Null/omitted = operator can work any table.',
  })
  @IsOptional()
  @IsUUID()
  tableId?: string;
}

class UpdateOperatorTableDto {
  @ApiProperty({
    example: 'table-uuid-here',
    required: false,
    nullable: true,
    description: 'Pass null to unassign the operator from a specific table.',
  })
  @IsOptional()
  @IsUUID()
  tableId?: string | null;
}

@ApiTags('Tournaments')
@Controller('v1/tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  // ─── Tournaments ─────────────────────────────────────────────────────────────

  @Public()
  @Get()
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'format', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('sport') sport?: string,
    @Query('status') status?: string,
    @Query('country') country?: string,
    @Query('format') format?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.tournamentsService.findAll({ sport, status, country, format, page, limit });
  }

  @Public()
  @Get('featured-armfight')
  @HttpCode(HttpStatus.OK)
  async featuredArmfight(@Res({ passthrough: true }) res: Response) {
    const t = await this.tournamentsService.findFeaturedArmfight();
    if (!t) {
      res.status(HttpStatus.NO_CONTENT);
      return undefined;
    }
    return t;
  }

  @Public()
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
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Request() req: any) {
    return this.tournamentsService.updateStatus(id, dto.status, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/registration/toggle')
  toggleRegistration(@Param('id') id: string, @Request() req: any) {
    return this.tournamentsService.toggleRegistration(id, req.user.sub);
  }

  // ─── Close Registration + Generate Brackets ──────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/close-registration')
  closeRegistration(@Param('id') id: string, @Request() req: any) {
    return this.tournamentsService.closeRegistration(id, req.user.sub);
  }

  // ─── Registrations ───────────────────────────────────────────────────────────

  @Public()
  @Get(':id/registrations')
  @ApiQuery({ name: 'ageGroup', required: false })
  @ApiQuery({ name: 'hand', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRegistrations(
    @Param('id') id: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('hand') hand?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.tournamentsService.getRegistrations(id, { ageGroup, hand, page, limit });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/registrations')
  register(@Param('id') id: string, @Body() dto: RegisterParticipantDto, @Request() req: any) {
    return this.tournamentsService.registerParticipant(id, req.user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/registrations/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelRegistration(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Request() req: any,
  ) {
    return this.tournamentsService.cancelRegistration(
      id,
      entryId,
      req.user.sub,
      req.user.roles ?? [],
    );
  }

  // ─── Operators ───────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get(':id/operators')
  getOperators(@Param('id') id: string) {
    return this.tournamentsService.getOperators(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/operators')
  assignOperator(@Param('id') id: string, @Body() dto: AssignOperatorDto, @Request() req: any) {
    return this.tournamentsService.assignOperator(id, dto.operatorId, req.user.sub, dto.tableId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/operators/:operatorId')
  updateOperatorTable(
    @Param('id') id: string,
    @Param('operatorId') operatorId: string,
    @Body() dto: UpdateOperatorTableDto,
    @Request() req: any,
  ) {
    return this.tournamentsService.updateOperatorTable(
      id,
      operatorId,
      dto.tableId ?? null,
      req.user.sub,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/operators/:operatorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeOperator(
    @Param('id') id: string,
    @Param('operatorId') operatorId: string,
    @Request() req: any,
  ) {
    return this.tournamentsService.removeOperator(id, operatorId, req.user.sub);
  }
}
