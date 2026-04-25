import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { UsersService } from '../users/users.service';
import { BracketsService } from '../brackets/brackets.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

@Injectable()
export class AdminService {
  private logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    @InjectRepository(TournamentOperator)
    private readonly operatorsRepository: Repository<TournamentOperator>,
    @InjectRepository(WeightCategory)
    private readonly weightCategoriesRepository: Repository<WeightCategory>,
    @InjectRepository(TournamentEntry)
    private readonly entriesRepository: Repository<TournamentEntry>,
    private readonly usersService: UsersService,
    private readonly bracketsService: BracketsService,
    private readonly dataSource: DataSource,
  ) {}

  /* ───────── Users (admin only) ───────── */

  async listUsers(page: number, limit: number) {
    return this.usersService.findAll(page, limit);
  }

  async updateUserRoles(targetId: string, roles: string[], requesterId: string) {
    const target = await this.usersService.findById(targetId);
    if (!target) throw new NotFoundException('User not found');
    if (target.id === requesterId) throw new ForbiddenException('Cannot change your own roles');
    const user = await this.usersService.updateRoles(targetId, roles);
    const { passwordHash: _ph, ...safe } = user as any;
    return safe;
  }

  /* ───────── Tournaments ───────── */

  /** List tournaments — admin sees all, organizer sees own */
  async listTournaments(userId: string, userRoles: string[]) {
    const isAdmin = userRoles.includes('admin');
    return this.tournamentsRepository.find({
      where: isAdmin ? {} : { organizerId: userId },
      relations: ['sport'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Get single tournament — admin can access any, organizer only own */
  async getTournament(id: string, userId: string, userRoles: string[]): Promise<Tournament> {
    const t = await this.tournamentsRepository.findOne({
      where: { id },
      relations: ['sport', 'weightCategories'],
    });
    if (!t) throw new NotFoundException('Tournament not found');
    const isAdmin = userRoles.includes('admin');
    if (!isAdmin && t.organizerId !== userId) throw new ForbiddenException('Access denied');
    return t;
  }

  /** Create new tournament */
  async createTournament(
    dto: CreateTournamentDto,
    userId: string,
    userRoles: string[],
  ): Promise<Tournament> {
    const slug = this.slugify(dto.name) + '-' + Date.now();
    const { weightCategories: wcInput, ...tournamentFields } = dto;

    const tournament = this.tournamentsRepository.create({
      ...tournamentFields,
      slug,
      organizerId: userId,
      status: 'upcoming',
      registrationOpen: false,
      bracketGenerated: false,
    });

    const saved = await this.tournamentsRepository.save(tournament);

    if (wcInput && wcInput.length > 0) {
      const wcs = wcInput.map((wc, idx) =>
        this.weightCategoriesRepository.create({
          tournamentId: saved.id,
          name: wc.name,
          minWeight: wc.minWeight ?? null,
          maxWeight: wc.maxWeight ?? null,
          sortOrder: wc.sortOrder ?? idx,
        }),
      );
      await this.weightCategoriesRepository.save(wcs);
    }

    this.logger.log(`Tournament created: ${saved.id} by user ${userId}`);
    return this.getTournament(saved.id, userId, userRoles);
  }

  /** Update tournament fields */
  async updateTournament(
    id: string,
    dto: UpdateTournamentDto,
    userId: string,
    userRoles: string[],
  ): Promise<Tournament> {
    const t = await this.getTournament(id, userId, userRoles);
    if (t.bracketGenerated) {
      throw new BadRequestException('Cannot edit tournament after bracket has been generated');
    }
    const { weightCategories: _wc, ...updateFields } = dto as any;
    await this.tournamentsRepository.update(id, updateFields);
    return this.getTournament(id, userId, userRoles);
  }

  /** Delete tournament (only if not yet started) */
  async deleteTournament(id: string, userId: string, userRoles: string[]): Promise<void> {
    const t = await this.getTournament(id, userId, userRoles);
    if (['active', 'completed', 'cancelled'].includes(t.status)) {
      throw new BadRequestException('Cannot delete a tournament that has already started or ended');
    }
    await this.tournamentsRepository.delete(id);
    this.logger.log(`Tournament deleted: ${id}`);
  }

  /** Toggle registration open/closed */
  async toggleRegistration(id: string, userId: string, userRoles: string[]): Promise<Tournament> {
    const t = await this.getTournament(id, userId, userRoles);
    if (t.bracketGenerated) {
      throw new BadRequestException('Registration cannot be reopened after bracket generation');
    }
    const newOpen = !t.registrationOpen;
    const newStatus = newOpen ? 'registration_open' : 'registration_closed';
    await this.tournamentsRepository.update(id, { registrationOpen: newOpen, status: newStatus });
    this.logger.log(`Tournament ${id}: registration ${newOpen ? 'opened' : 'closed'}`);
    return this.getTournament(id, userId, userRoles);
  }

  /** Close registration AND generate brackets */
  async closeAndGenerateBrackets(
    id: string,
    userId: string,
    userRoles: string[],
    bracketFormat?: import('@gsm/shared-types').BracketFormat,
  ): Promise<{ bracketsCreated: number }> {
    const t = await this.getTournament(id, userId, userRoles);
    if (t.bracketGenerated) {
      throw new BadRequestException('Bracket already generated for this tournament');
    }
    const bracketsCreated = await this.bracketsService.generateWithWeightBuckets(
      id,
      bracketFormat,
    );
    this.logger.log(
      `Tournament ${id}: ${bracketsCreated} bracket(s) generated` +
        (bracketFormat ? ` (format: ${bracketFormat})` : ''),
    );
    return { bracketsCreated };
  }

  /* ───────── Operators ───────── */

  async listOperators(tournamentId: string, userId: string, userRoles: string[]) {
    await this.getTournament(tournamentId, userId, userRoles);
    const ops = await this.operatorsRepository.find({
      where: { tournamentId },
      order: { assignedAt: 'ASC' },
    });
    return Promise.all(
      ops.map(async (op) => {
        const user = await this.usersService.findById(op.operatorId);
        return {
          ...op,
          user: user
            ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }
            : null,
        };
      }),
    );
  }

  async assignOperator(tournamentId: string, email: string, userId: string, userRoles: string[]) {
    await this.getTournament(tournamentId, userId, userRoles);
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException(`User with email ${email} not found`);
    const exists = await this.operatorsRepository.findOne({
      where: { tournamentId, operatorId: user.id },
    });
    if (exists) throw new BadRequestException('User is already an operator for this tournament');
    const op = this.operatorsRepository.create({ tournamentId, operatorId: user.id });
    await this.operatorsRepository.save(op);
    this.logger.log(`Operator ${user.id} assigned to tournament ${tournamentId}`);
    return {
      operatorId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  async removeOperator(
    tournamentId: string,
    operatorId: string,
    userId: string,
    userRoles: string[],
  ) {
    await this.getTournament(tournamentId, userId, userRoles);
    await this.operatorsRepository.delete({ tournamentId, operatorId });
    this.logger.log(`Operator ${operatorId} removed from tournament ${tournamentId}`);
  }

  /* ───────── Bracket management (admin / organizer) ───────── */

  /** Get all brackets for a tournament with full data */
  async getBrackets(tournamentId: string, userId: string, userRoles: string[]) {
    await this.getTournament(tournamentId, userId, userRoles);
    return this.bracketsService.findByTournament(tournamentId);
  }

  /** Correct a match result (force-overwrite) — reason is required for audit trail */
  async correctMatchResult(
    bracketId: string,
    matchId: string,
    winnerId: string,
    userId: string,
    userRoles: string[],
    reason?: string,
    result?: Record<string, unknown> | null,
  ) {
    const trimmed = reason?.trim() ?? '';
    // Align with CorrectResultDto @MinLength(3): defend against non-HTTP callers
    // (tests, internal services) that bypass the DTO validation pipeline.
    if (trimmed.length < 3) {
      throw new BadRequestException(
        'Reason is required (min 3 characters) when correcting an already-recorded result',
      );
    }
    return this.bracketsService.recordResult(
      bracketId,
      { matchId, winnerId, notes: trimmed, forceCorrect: true, result },
      userId,
      userRoles,
    );
  }

  /** Reset a single match result and all downstream matches */
  async resetMatch(
    bracketId: string,
    matchId: string,
    userId: string,
    userRoles: string[],
    reason?: string,
  ) {
    return this.bracketsService.resetSingleMatch(bracketId, { matchId, reason }, userId, userRoles);
  }

  /** Lock bracket (only admin/organizer can change results after this) */
  async lockBracket(bracketId: string, userId: string, userRoles: string[]) {
    return this.bracketsService.setLocked(bracketId, true, userId, userRoles);
  }

  /** Unlock bracket */
  async unlockBracket(bracketId: string, userId: string, userRoles: string[]) {
    return this.bracketsService.setLocked(bracketId, false, userId, userRoles);
  }

  /** Get audit log of all changes */
  async getBracketAuditLog(bracketId: string, userId: string, userRoles: string[]) {
    const bracket = await this.bracketsService.findById(bracketId);
    await this.getTournament(bracket.tournamentId, userId, userRoles);
    return this.bracketsService.getAuditLog(bracketId, userId, userRoles);
  }

  async getParticipantCount(tournamentId: string): Promise<number> {
    return this.entriesRepository.count({ where: { tournamentId, status: 'confirmed' } });
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
  }
}
