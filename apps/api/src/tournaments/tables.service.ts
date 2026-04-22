import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentTable } from './entities/tournament-table.entity';
import { Tournament } from './entities/tournament.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class TablesService {
  private logger = new Logger(TablesService.name);

  constructor(
    @InjectRepository(TournamentTable)
    private readonly tablesRepository: Repository<TournamentTable>,
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
  ) {}

  /** Public — any caller can see the tables of a tournament (arena display, etc). */
  async findByTournament(tournamentId: string): Promise<TournamentTable[]> {
    await this.ensureTournamentExists(tournamentId);
    return this.tablesRepository.find({
      where: { tournamentId },
      order: { number: 'ASC' },
    });
  }

  async create(
    tournamentId: string,
    dto: CreateTableDto,
    userId: string,
  ): Promise<TournamentTable> {
    await this.ensureOrganizer(tournamentId, userId);

    const duplicate = await this.tablesRepository.findOne({
      where: { tournamentId, number: dto.number },
    });
    if (duplicate) {
      throw new ConflictException(`Table #${dto.number} already exists in this tournament`);
    }

    const table = this.tablesRepository.create({
      tournamentId,
      number: dto.number,
      name: dto.name ?? null,
      status: dto.status ?? 'idle',
      notes: dto.notes ?? null,
    });
    const saved = await this.tablesRepository.save(table);
    this.logger.log(`Table #${saved.number} created for tournament ${tournamentId}`);
    return saved;
  }

  async update(
    tournamentId: string,
    tableId: string,
    dto: UpdateTableDto,
    userId: string,
  ): Promise<TournamentTable> {
    await this.ensureOrganizer(tournamentId, userId);
    const table = await this.findOneOrThrow(tournamentId, tableId);

    if (dto.number !== undefined && dto.number !== table.number) {
      const duplicate = await this.tablesRepository.findOne({
        where: { tournamentId, number: dto.number },
      });
      if (duplicate && duplicate.id !== tableId) {
        throw new ConflictException(`Table #${dto.number} already exists in this tournament`);
      }
    }

    Object.assign(table, {
      number: dto.number ?? table.number,
      name: dto.name !== undefined ? dto.name : table.name,
      status: dto.status ?? table.status,
      notes: dto.notes !== undefined ? dto.notes : table.notes,
    });
    return this.tablesRepository.save(table);
  }

  async remove(tournamentId: string, tableId: string, userId: string): Promise<void> {
    await this.ensureOrganizer(tournamentId, userId);
    const table = await this.findOneOrThrow(tournamentId, tableId);
    await this.tablesRepository.remove(table);
    this.logger.log(`Table ${tableId} removed from tournament ${tournamentId}`);
  }

  private async findOneOrThrow(
    tournamentId: string,
    tableId: string,
  ): Promise<TournamentTable> {
    const table = await this.tablesRepository.findOne({
      where: { id: tableId, tournamentId },
    });
    if (!table) throw new NotFoundException(`Table ${tableId} not found in this tournament`);
    return table;
  }

  private async ensureTournamentExists(tournamentId: string): Promise<Tournament> {
    const tournament = await this.tournamentsRepository.findOne({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException(`Tournament #${tournamentId} not found`);
    return tournament;
  }

  private async ensureOrganizer(tournamentId: string, userId: string): Promise<Tournament> {
    const tournament = await this.ensureTournamentExists(tournamentId);
    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can manage tables for this tournament');
    }
    return tournament;
  }
}
