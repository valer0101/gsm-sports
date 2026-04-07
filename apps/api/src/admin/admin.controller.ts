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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { AssignOperatorDto } from './dto/assign-operator.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'organizer')
@Controller('v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /* ───────── Tournaments ───────── */

  @Get('tournaments')
  listTournaments(@Request() req: any) {
    return this.adminService.listTournaments(req.user.sub);
  }

  @Get('tournaments/:id')
  getTournament(@Param('id') id: string, @Request() req: any) {
    return this.adminService.getTournament(id, req.user.sub);
  }

  @Post('tournaments')
  createTournament(@Body() dto: CreateTournamentDto, @Request() req: any) {
    return this.adminService.createTournament(dto, req.user.sub);
  }

  @Patch('tournaments/:id')
  updateTournament(@Param('id') id: string, @Body() dto: UpdateTournamentDto, @Request() req: any) {
    return this.adminService.updateTournament(id, dto, req.user.sub);
  }

  @Delete('tournaments/:id')
  deleteTournament(@Param('id') id: string, @Request() req: any) {
    return this.adminService.deleteTournament(id, req.user.sub);
  }

  /* ───────── Registration ───────── */

  @Patch('tournaments/:id/toggle-registration')
  toggleRegistration(@Param('id') id: string, @Request() req: any) {
    return this.adminService.toggleRegistration(id, req.user.sub);
  }

  @Post('tournaments/:id/generate-brackets')
  generateBrackets(@Param('id') id: string, @Request() req: any) {
    return this.adminService.closeAndGenerateBrackets(id, req.user.sub);
  }

  /* ───────── Operators ───────── */

  @Get('tournaments/:id/operators')
  listOperators(@Param('id') id: string, @Request() req: any) {
    return this.adminService.listOperators(id, req.user.sub);
  }

  @Post('tournaments/:id/operators')
  assignOperator(@Param('id') id: string, @Body() dto: AssignOperatorDto, @Request() req: any) {
    return this.adminService.assignOperator(id, dto.email, req.user.sub);
  }

  @Delete('tournaments/:id/operators/:operatorId')
  removeOperator(
    @Param('id') id: string,
    @Param('operatorId') operatorId: string,
    @Request() req: any,
  ) {
    return this.adminService.removeOperator(id, operatorId, req.user.sub);
  }
}
