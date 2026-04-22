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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { Public } from '../auth/public.decorator';

@ApiTags('Tournament Tables')
@Controller('v1/tournaments/:tournamentId/tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Public()
  @Get()
  findAll(@Param('tournamentId') tournamentId: string) {
    return this.tablesService.findByTournament(tournamentId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateTableDto,
    @Request() req: any,
  ) {
    return this.tablesService.create(tournamentId, dto, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':tableId')
  update(
    @Param('tournamentId') tournamentId: string,
    @Param('tableId') tableId: string,
    @Body() dto: UpdateTableDto,
    @Request() req: any,
  ) {
    return this.tablesService.update(tournamentId, tableId, dto, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':tableId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('tournamentId') tournamentId: string,
    @Param('tableId') tableId: string,
    @Request() req: any,
  ) {
    return this.tablesService.remove(tournamentId, tableId, req.user.sub);
  }
}
