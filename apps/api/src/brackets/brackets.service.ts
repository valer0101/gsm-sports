import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generateDoubleElimination, selectWinner } from '@gsm/bracket-engine';
import type { Player, BracketData } from '@gsm/bracket-engine';
import { Bracket, BracketStatus } from './entities/bracket.entity';
import { TournamentsService } from '../tournaments/tournaments.service';
import { EntriesService } from '../entries/entries.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';

@Injectable()
export class BracketsService {
  private logger = new Logger(BracketsService.name);

  constructor(
    @InjectRepository(Bracket)
    private readonly bracketsRepository: Repository<Bracket>,
    private readonly tournamentsService: TournamentsService,
    private readonly entriesService: EntriesService,
  ) {}

  async generate(dto: GenerateBracketDto, organizerId: string): Promise<Bracket> {
    const tournament = await this.tournamentsService.findById(dto.tournamentId);

    if (tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Only the organizer can generate brackets');
    }

    // Load confirmed entries for this tournament / weight category
    const { data: entries } = await this.entriesService.findByTournament(dto.tournamentId, {
      status: 'confirmed',
      weightCategoryId: dto.weightCategoryId,
      limit: 200,
    });

    if (entries.length < 2) {
      throw new BadRequestException(
        'At least 2 confirmed entries are required to generate a bracket',
      );
    }

    // Build Player array — apply custom seeds if provided
    const seedMap = new Map((dto.playerSeeds ?? []).map(({ entryId, seed }) => [entryId, seed]));

    const players: Player[] = entries
      .map((entry) => ({
        id: entry.id,
        firstName: entry.user.firstName,
        lastName: entry.user.lastName,
        number: seedMap.get(entry.id) ?? entry.seedNumber ?? 0,
        seed: seedMap.get(entry.id) ?? entry.seedNumber ?? undefined,
      }))
      .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));

    const bracketData = generateDoubleElimination(players);

    const bracket = this.bracketsRepository.create({
      tournamentId: dto.tournamentId,
      weightCategoryId: dto.weightCategoryId ?? null,
      name: dto.name ?? null,
      status: 'active',
      bracketData: bracketData as unknown as Record<string, unknown>,
    });

    const saved = await this.bracketsRepository.save(bracket);
    this.logger.log(
      `Bracket generated for tournament ${dto.tournamentId} (${entries.length} players)`,
    );
    return saved;
  }

  async findById(id: string): Promise<Bracket> {
    const bracket = await this.bracketsRepository.findOne({
      where: { id },
      relations: ['tournament', 'weightCategory'],
    });
    if (!bracket) throw new NotFoundException(`Bracket #${id} not found`);
    return bracket;
  }

  async findByTournament(tournamentId: string): Promise<Bracket[]> {
    return this.bracketsRepository.find({
      where: { tournamentId },
      relations: ['weightCategory'],
      order: { createdAt: 'ASC' },
    });
  }

  async recordResult(
    bracketId: string,
    matchId: string,
    winnerId: string,
    organizerId: string,
  ): Promise<Bracket> {
    const bracket = await this.findById(bracketId);

    if (bracket.tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Only the organizer can record match results');
    }

    if (bracket.status === 'completed') {
      throw new BadRequestException('Bracket is already completed');
    }

    if (!bracket.bracketData) {
      throw new BadRequestException('Bracket has no data');
    }

    const updated = selectWinner(bracket.bracketData as unknown as BracketData, matchId, winnerId);

    const newStatus = updated.status === 'completed' ? 'completed' : 'active';

    await this.bracketsRepository.update(bracketId, {
      bracketData: updated as unknown as Record<string, unknown>,
      status: newStatus as BracketStatus,
    } as any);

    if (newStatus === 'completed') {
      this.logger.log(`Bracket ${bracketId} completed. Champion: ${updated.champion}`);
    }

    return this.findById(bracketId);
  }

  async reset(bracketId: string, organizerId: string): Promise<Bracket> {
    const bracket = await this.findById(bracketId);

    if (bracket.tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Only the organizer can reset a bracket');
    }

    await this.bracketsRepository.update(bracketId, {
      bracketData: null,
      status: 'pending',
    });

    return this.findById(bracketId);
  }
}
