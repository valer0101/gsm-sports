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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { AssignOperatorDto } from './dto/assign-operator.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { CorrectResultDto } from './dto/correct-result.dto';
import { ResetMatchDto } from './dto/reset-match.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /* ───────── Users (admin only) ───────── */

  @Roles('admin')
  @Get('users')
  listUsers(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.listUsers(Number(page), Number(limit));
  }

  @Roles('admin')
  @Patch('users/:id/roles')
  updateUserRoles(@Param('id') id: string, @Body() dto: UpdateUserRolesDto, @Request() req: any) {
    return this.adminService.updateUserRoles(id, dto.roles, req.user.sub);
  }

  /* ───────── Tournaments ───────── */

  @Roles('admin', 'organizer')
  @Get('tournaments')
  listTournaments(@Request() req: any) {
    return this.adminService.listTournaments(req.user.sub, req.user.roles);
  }

  @Roles('admin', 'organizer')
  @Get('tournaments/:id')
  getTournament(@Param('id') id: string, @Request() req: any) {
    return this.adminService.getTournament(id, req.user.sub, req.user.roles);
  }

  @Roles('admin', 'organizer')
  @Post('tournaments')
  createTournament(@Body() dto: CreateTournamentDto, @Request() req: any) {
    return this.adminService.createTournament(dto, req.user.sub, req.user.roles);
  }

  @Roles('admin', 'organizer')
  @Patch('tournaments/:id')
  updateTournament(@Param('id') id: string, @Body() dto: UpdateTournamentDto, @Request() req: any) {
    return this.adminService.updateTournament(id, dto, req.user.sub, req.user.roles);
  }

  @Roles('admin', 'organizer')
  @Delete('tournaments/:id')
  deleteTournament(@Param('id') id: string, @Request() req: any) {
    return this.adminService.deleteTournament(id, req.user.sub, req.user.roles);
  }

  /* ───────── Registration ───────── */

  @Roles('admin', 'organizer')
  @Patch('tournaments/:id/toggle-registration')
  toggleRegistration(@Param('id') id: string, @Request() req: any) {
    return this.adminService.toggleRegistration(id, req.user.sub, req.user.roles);
  }

  @Roles('admin', 'organizer')
  @Post('tournaments/:id/generate-brackets')
  generateBrackets(@Param('id') id: string, @Request() req: any) {
    return this.adminService.closeAndGenerateBrackets(id, req.user.sub, req.user.roles);
  }

  /* ───────── Operators ───────── */

  @Roles('admin', 'organizer')
  @Get('tournaments/:id/operators')
  listOperators(@Param('id') id: string, @Request() req: any) {
    return this.adminService.listOperators(id, req.user.sub, req.user.roles);
  }

  @Roles('admin', 'organizer')
  @Post('tournaments/:id/operators')
  assignOperator(@Param('id') id: string, @Body() dto: AssignOperatorDto, @Request() req: any) {
    return this.adminService.assignOperator(id, dto.email, req.user.sub, req.user.roles);
  }

  @Roles('admin', 'organizer')
  @Delete('tournaments/:id/operators/:operatorId')
  removeOperator(
    @Param('id') id: string,
    @Param('operatorId') operatorId: string,
    @Request() req: any,
  ) {
    return this.adminService.removeOperator(id, operatorId, req.user.sub, req.user.roles);
  }

  /* ───────── Bracket management ───────── */

  @Roles('admin', 'organizer')
  @Get('tournaments/:id/brackets')
  getBrackets(@Param('id') id: string, @Request() req: any) {
    return this.adminService.getBrackets(id, req.user.sub, req.user.roles);
  }

  @Roles('admin', 'organizer')
  @Patch('brackets/:bracketId/correct-result')
  correctMatchResult(
    @Param('bracketId') bracketId: string,
    @Body() dto: CorrectResultDto,
    @Request() req: any,
  ) {
    return this.adminService.correctMatchResult(
      bracketId,
      dto.matchId,
      dto.winnerId,
      req.user.sub,
      req.user.roles,
      dto.reason,
    );
  }

  @Roles('admin', 'organizer')
  @Patch('brackets/:bracketId/reset-match')
  resetMatch(
    @Param('bracketId') bracketId: string,
    @Body() dto: ResetMatchDto,
    @Request() req: any,
  ) {
    return this.adminService.resetMatch(
      bracketId,
      dto.matchId,
      req.user.sub,
      req.user.roles,
      dto.reason,
    );
  }

  @Roles('admin', 'organizer')
  @Patch('brackets/:bracketId/lock')
  lockBracket(@Param('bracketId') bracketId: string, @Request() req: any) {
    return this.adminService.lockBracket(bracketId, req.user.sub, req.user.roles);
  }

  @Roles('admin', 'organizer')
  @Patch('brackets/:bracketId/unlock')
  unlockBracket(@Param('bracketId') bracketId: string, @Request() req: any) {
    return this.adminService.unlockBracket(bracketId, req.user.sub, req.user.roles);
  }

  @Roles('admin', 'organizer')
  @Get('brackets/:bracketId/audit')
  getBracketAuditLog(@Param('bracketId') bracketId: string, @Request() req: any) {
    return this.adminService.getBracketAuditLog(bracketId, req.user.sub, req.user.roles);
  }
}
