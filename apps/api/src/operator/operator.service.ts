import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { TournamentTable } from '../tournaments/entities/tournament-table.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { BracketsService } from '../brackets/brackets.service';
import { MatchAssignmentsService } from '../match-assignments/match-assignments.service';
import type { BracketData } from '@gsm/bracket-engine';

@Injectable()
export class OperatorService {
  private logger = new Logger(OperatorService.name);

  constructor(
    @InjectRepository(TournamentOperator)
    private readonly operatorsRepository: Repository<TournamentOperator>,
    @InjectRepository(TournamentTable)
    private readonly tablesRepository: Repository<TournamentTable>,
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    private readonly bracketsService: BracketsService,
    private readonly matchAssignmentsService: MatchAssignmentsService,
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

  /**
   * Pending (playable) matches across the tournament's brackets. Shape:
   *
   *   - matches already claimed to THIS operator's table are surfaced with
   *     `assignedToMe: true` + the assignment row (so the UI can show "running"),
   *   - matches claimed to some OTHER table are hidden from a pinned operator
   *     and shown as `assignedToOther: true` to a roaming operator,
   *   - unclaimed matches are `assignedToMe: false, assignedToOther: false`.
   */
  async getPendingMatches(tournamentId: string, operatorId: string) {
    const operator = await this.verifyAccess(tournamentId, operatorId);
    const brackets = await this.bracketsService.findByTournament(tournamentId);
    const activeAssignments =
      await this.matchAssignmentsService.getActiveByTournament(tournamentId);

    const byMatchId = new Map(activeAssignments.map((a) => [a.matchId, a]));

    return brackets
      .filter((b) => b.bracketData && b.status === 'active')
      .map((b) => {
        const pending = this.bracketsService.getPendingMatches(
          b.bracketData as unknown as BracketData,
        );
        const annotated = pending
          .map((m) => {
            const assignment = byMatchId.get(m.matchId) ?? null;
            const assignedToMe =
              !!assignment && operator.tableId !== null && assignment.tableId === operator.tableId;
            const assignedToOther = !!assignment && !assignedToMe;
            return { ...m, assignment, assignedToMe, assignedToOther };
          })
          .filter((m) => {
            // If operator is pinned to a specific table, hide matches claimed
            // elsewhere — they aren't actionable.
            if (operator.tableId !== null && m.assignedToOther) return false;
            return true;
          });

        return {
          bracketId: b.id,
          bracketName: b.name,
          isLocked: b.isLocked,
          pendingMatches: annotated,
        };
      })
      .filter((b) => b.pendingMatches.length > 0);
  }

  /** Summary of the operator's own table assignment + what's running on it. */
  async getMyTable(tournamentId: string, operatorId: string) {
    const operator = await this.verifyAccess(tournamentId, operatorId);
    if (!operator.tableId) return null;

    const table = await this.tablesRepository.findOne({
      where: { id: operator.tableId, tournamentId },
    });
    if (!table) return null;

    const activeAssignment = await this.matchAssignmentsService.getActiveByTable(table.id);
    return { table, activeAssignment };
  }

  /** Claim the next playable match to a table. */
  async claimNextMatch(tournamentId: string, tableId: string, operatorId: string) {
    // verifyAccess checks membership; claimNextForTable re-checks table-pin.
    await this.verifyAccess(tournamentId, operatorId);
    return this.matchAssignmentsService.claimNextForTable(tournamentId, tableId, operatorId, {
      isOrganizer: false,
      isAdmin: false,
    });
  }

  /** Record match result */
  async recordResult(
    bracketId: string,
    matchId: string,
    winnerId: string,
    operatorId: string,
    notes?: string,
  ) {
    return this.bracketsService.recordResult(
      bracketId,
      { matchId, winnerId, notes },
      operatorId,
      [],
    );
  }

  private async verifyAccess(
    tournamentId: string,
    operatorId: string,
  ): Promise<TournamentOperator> {
    const assignment = await this.operatorsRepository.findOne({
      where: { tournamentId, operatorId },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned as operator for this tournament');
    }
    return assignment;
  }
}
