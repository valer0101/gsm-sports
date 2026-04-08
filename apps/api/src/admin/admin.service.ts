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

  /** List all tournaments for this organizer */
  async listTournaments(organizerId: string) {
    return this.tournamentsRepository.find({
      where: { organizerId },
      relations: ['sport'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Get single tournament (must belong to organizer) */
  async getTournament(id: string, organizerId: string): Promise<Tournament> {
    const t = await this.tournamentsRepository.findOne({
      where: { id },
      relations: ['sport', 'weightCategories'],
    });
    if (!t) throw new NotFoundException('Tournament not found');
    if (t.organizerId !== organizerId) throw new ForbiddenException('Access denied');
    return t;
  }

  /** Create new tournament */
  async createTournament(dto: CreateTournamentDto, organizerId: string): Promise<Tournament> {
    const slug = this.slugify(dto.name) + '-' + Date.now();

    const { weightCategories: wcInput, ...tournamentFields } = dto;

    const tournament = this.tournamentsRepository.create({
      ...tournamentFields,
      slug,
      organizerId,
      status: 'upcoming',
      registrationOpen: false,
      bracketGenerated: false,
    });

    const saved = await this.tournamentsRepository.save(tournament);

    // Create weight categories if provided
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

    this.logger.log(`Tournament created: ${saved.id} by organizer ${organizerId}`);
    return this.getTournament(saved.id, organizerId);
  }

  /** Update tournament fields */
  async updateTournament(
    id: string,
    dto: UpdateTournamentDto,
    organizerId: string,
  ): Promise<Tournament> {
    const t = await this.getTournament(id, organizerId);
    if (t.bracketGenerated) {
      throw new BadRequestException('Cannot edit tournament after bracket has been generated');
    }
    const { weightCategories: _wc, ...updateFields } = dto as any;
    await this.tournamentsRepository.update(id, updateFields);
    return this.getTournament(id, organizerId);
  }

  /** Delete tournament (only if not yet started) */
  async deleteTournament(id: string, organizerId: string): Promise<void> {
    const t = await this.getTournament(id, organizerId);
    if (['active', 'completed', 'cancelled'].includes(t.status)) {
      throw new BadRequestException('Cannot delete a tournament that has already started or ended');
    }
    await this.tournamentsRepository.delete(id);
    this.logger.log(`Tournament deleted: ${id}`);
  }

  /** Toggle registration open/closed */
  async toggleRegistration(id: string, organizerId: string): Promise<Tournament> {
    const t = await this.getTournament(id, organizerId);
    if (t.bracketGenerated) {
      throw new BadRequestException('Registration cannot be reopened after bracket generation');
    }
    const newOpen = !t.registrationOpen;
    const newStatus = newOpen ? 'registration_open' : 'registration_closed';
    await this.tournamentsRepository.update(id, {
      registrationOpen: newOpen,
      status: newStatus,
    });
    this.logger.log(`Tournament ${id}: registration ${newOpen ? 'opened' : 'closed'}`);
    return this.getTournament(id, organizerId);
  }

  /** Close registration AND generate brackets grouped by (ageGroup, hand, weightBucket) */
  async closeAndGenerateBrackets(
    id: string,
    organizerId: string,
  ): Promise<{ bracketsCreated: number }> {
    const t = await this.getTournament(id, organizerId);

    if (t.bracketGenerated) {
      throw new BadRequestException('Bracket already generated for this tournament');
    }

    const bracketsCreated = await this.bracketsService.generateWithWeightBuckets(id);
    this.logger.log(`Tournament ${id}: ${bracketsCreated} bracket(s) generated`);
    return { bracketsCreated };
  }

  /** List operators assigned to a tournament */
  async listOperators(tournamentId: string, organizerId: string) {
    await this.getTournament(tournamentId, organizerId); // verify ownership
    const ops = await this.operatorsRepository.find({
      where: { tournamentId },
      order: { assignedAt: 'ASC' },
    });
    // Enrich with user info
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

  /** Assign an operator by email */
  async assignOperator(tournamentId: string, email: string, organizerId: string) {
    await this.getTournament(tournamentId, organizerId);

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

  /** Remove an operator */
  async removeOperator(tournamentId: string, operatorId: string, organizerId: string) {
    await this.getTournament(tournamentId, organizerId);
    await this.operatorsRepository.delete({ tournamentId, operatorId });
    this.logger.log(`Operator ${operatorId} removed from tournament ${tournamentId}`);
  }

  /** Get participant count for a tournament */
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
