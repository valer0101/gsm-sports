import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { BracketsService } from '../brackets/brackets.service';

@Injectable()
export class OperatorService {
  private logger = new Logger(OperatorService.name);

  constructor(
    @InjectRepository(TournamentOperator)
    private readonly operatorsRepository: Repository<TournamentOperator>,
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    private readonly bracketsService: BracketsService,
  ) {}

  /** List active tournaments assigned to this operator */
  async myTournaments(operatorId: string) {
    const assignments = await this.operatorsRepository.find({
      where: { operatorId },
      order: { assignedAt: 'DESC' },
    });

    const tournamentIds = assignments.map((a) => a.tournamentId);
    if (tournamentIds.length === 0) return [];

    const tournaments = await this.tournamentsRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sport', 'sport')
      .where('t.id IN (:...ids)', { ids: tournamentIds })
      .andWhere("t.status NOT IN ('completed', 'cancelled')")
      .orderBy('t.startDate', 'ASC')
      .getMany();

    return tournaments;
  }

  /** Get brackets for a tournament (operator must be assigned) */
  async getBrackets(tournamentId: string, operatorId: string) {
    await this.verifyAccess(tournamentId, operatorId);
    return this.bracketsService.findByTournament(tournamentId);
  }

  /** Record match result */
  async recordResult(bracketId: string, matchId: string, winnerId: string, operatorId: string) {
    // BracketsService.recordResult already checks operator access via DB
    return this.bracketsService.recordResult(bracketId, matchId, winnerId, operatorId, []);
  }

  private async verifyAccess(tournamentId: string, operatorId: string) {
    const assignment = await this.operatorsRepository.findOne({
      where: { tournamentId, operatorId },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned as operator for this tournament');
    }
  }
}
