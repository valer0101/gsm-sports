import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { walkBracketMatches, isPlayableMatch } from '@gsm/bracket-engine';
import type { BracketData } from '@gsm/bracket-engine';
import { MatchTableAssignment } from './entities/match-table-assignment.entity';
import { TournamentTable } from '../tournaments/entities/tournament-table.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { Bracket } from '../brackets/entities/bracket.entity';

/**
 * Owns the lifecycle of a match-to-table binding:
 *   claim (operator/organizer takes the next pending match to a table)
 *     → finish (table freed + assignment closed when the result is recorded)
 *
 * Service-layer guarantees (not enforced by the DB):
 *   - at most one active (`finishedAt IS NULL`) assignment per (tournament, match)
 *   - at most one active assignment per table (table.status flips idle↔busy)
 *   - operator can only claim on a table they're allowed to work (null = any,
 *     otherwise must match their pinned tableId)
 */
@Injectable()
export class MatchAssignmentsService {
  private logger = new Logger(MatchAssignmentsService.name);

  constructor(
    @InjectRepository(MatchTableAssignment)
    private readonly assignmentsRepository: Repository<MatchTableAssignment>,
    @InjectRepository(TournamentTable)
    private readonly tablesRepository: Repository<TournamentTable>,
    @InjectRepository(TournamentOperator)
    private readonly operatorsRepository: Repository<TournamentOperator>,
    @InjectRepository(Bracket)
    private readonly bracketsRepository: Repository<Bracket>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Return the currently-active assignment on the table, if any.
   * Public-readable — no auth enforced here; callers must gate as appropriate.
   */
  async getActiveByTable(tableId: string): Promise<MatchTableAssignment | null> {
    return this.assignmentsRepository.findOne({
      where: { tableId, finishedAt: IsNull() },
      order: { assignedAt: 'DESC' },
    });
  }

  /** Return the active assignment for a match, if one exists. */
  async getActiveByMatch(
    tournamentId: string,
    matchId: string,
  ): Promise<MatchTableAssignment | null> {
    return this.assignmentsRepository.findOne({
      where: { tournamentId, matchId, finishedAt: IsNull() },
    });
  }

  /** Bulk lookup: active assignments across all tables of a tournament. */
  async getActiveByTournament(tournamentId: string): Promise<MatchTableAssignment[]> {
    return this.assignmentsRepository.find({
      where: { tournamentId, finishedAt: IsNull() },
    });
  }

  /**
   * Operator (or admin/organizer standing in) claims the next playable match
   * that isn't already on a table. Runs inside a transaction so the
   * "active assignment" uniqueness and the `table.status = 'busy'` flip are
   * consistent with each other.
   */
  async claimNextForTable(
    tournamentId: string,
    tableId: string,
    userId: string,
    opts: { isOrganizer: boolean; isAdmin: boolean } = { isOrganizer: false, isAdmin: false },
  ): Promise<MatchTableAssignment> {
    // ─── Access: operator must be assigned to this tournament AND either ──
    // roaming (null tableId) or pinned to THIS table. Organizer/admin bypass.
    if (!opts.isOrganizer && !opts.isAdmin) {
      const op = await this.operatorsRepository.findOne({
        where: { tournamentId, operatorId: userId },
      });
      if (!op) {
        throw new ForbiddenException('You are not an operator for this tournament');
      }
      if (op.tableId !== null && op.tableId !== tableId) {
        throw new ForbiddenException('You are pinned to a different table');
      }
    }

    return this.dataSource.transaction(async (em) => {
      const tableRepo = em.getRepository(TournamentTable);
      const assignRepo = em.getRepository(MatchTableAssignment);
      const bracketRepo = em.getRepository(Bracket);

      const table = await tableRepo.findOne({ where: { id: tableId, tournamentId } });
      if (!table) {
        throw new NotFoundException('Table does not belong to this tournament');
      }
      if (table.status === 'offline') {
        throw new BadRequestException('Table is offline');
      }
      // If the table already has an active assignment, the UI should be
      // telling the user "finish the current match first".
      const existingOnTable = await assignRepo.findOne({
        where: { tableId, finishedAt: IsNull() },
      });
      if (existingOnTable) {
        throw new ConflictException('Table already has an active match');
      }

      // ─── Find the next pending match across this tournament's brackets ──
      const brackets = await bracketRepo.find({
        where: { tournamentId },
        order: { createdAt: 'ASC' },
      });

      const active = await assignRepo.find({
        where: { tournamentId, finishedAt: IsNull() },
      });
      const takenMatchIds = new Set(active.map((a) => a.matchId));

      const pick = this.findFirstClaimableMatch(brackets, takenMatchIds);
      if (!pick) {
        throw new NotFoundException('No pending matches available to claim');
      }

      const now = new Date();
      const record = assignRepo.create({
        tournamentId,
        bracketId: pick.bracketId,
        matchId: pick.matchId,
        tableId,
        claimedBy: userId,
        assignedAt: now,
        startedAt: now,
        finishedAt: null,
      });

      // The UNIQUE partial index (tournament_id, match_id) WHERE finished_at
      // IS NULL is the ultimate guard against concurrent claims picking the
      // same match — translate the Postgres error into a friendly 409 for
      // the loser of the race.
      let saved: MatchTableAssignment;
      try {
        saved = await assignRepo.save(record);
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === '23505') {
          throw new ConflictException(
            'Match was just claimed by another table — try again',
          );
        }
        throw err;
      }

      await tableRepo.update(tableId, { status: 'busy' });

      this.logger.log(
        `Table ${table.number} (t=${tournamentId}) claimed match ${pick.matchId} by ${userId}`,
      );
      return saved;
    });
  }

  /**
   * Called from BracketsService after a result is recorded — closes any
   * active assignment for this match and frees the table. No-op if the match
   * wasn't currently assigned (result was recorded outside the table flow).
   */
  async finishForMatch(tournamentId: string, matchId: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const assignRepo = em.getRepository(MatchTableAssignment);
      const tableRepo = em.getRepository(TournamentTable);

      const active = await assignRepo.findOne({
        where: { tournamentId, matchId, finishedAt: IsNull() },
      });
      if (!active) return;

      const finishedAt = new Date();
      await assignRepo.update(active.id, { finishedAt });

      // Only flip status to idle if no OTHER match is currently active on the
      // same table. In normal flow there won't be — but belt-and-braces.
      const stillBusy = await assignRepo.count({
        where: { tableId: active.tableId, finishedAt: IsNull() },
      });
      if (stillBusy === 0) {
        await tableRepo.update(active.tableId, { status: 'idle' });
      }
    });
  }

  /** Pick the first match that is playable AND not currently claimed. */
  private findFirstClaimableMatch(
    brackets: Bracket[],
    takenMatchIds: Set<string>,
  ): { bracketId: string; matchId: string } | null {
    for (const b of brackets) {
      if (!b.bracketData || b.status !== 'active' || b.isLocked) continue;
      const data = b.bracketData as unknown as BracketData;

      let found: string | null = null;
      walkBracketMatches(data, (match) => {
        if (!isPlayableMatch(match)) return;
        if (takenMatchIds.has(match.id)) return;
        found = match.id;
        // Return `false` — first claimable match is the answer, stop walking.
        return false;
      });

      if (found) return { bracketId: b.id, matchId: found };
    }
    return null;
  }
}
