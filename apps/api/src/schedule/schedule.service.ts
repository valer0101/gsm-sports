import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { buildSchedule } from '@gsm/scheduler';
import type {
  SchedulerMatch,
  SchedulerTable,
  SchedulerOutput,
} from '@gsm/scheduler';
import type { BracketData } from '@gsm/bracket-engine';
import type { SportConfig } from '@gsm/shared-types';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentTable } from '../tournaments/entities/tournament-table.entity';
import { Bracket } from '../brackets/entities/bracket.entity';
import { MatchTableAssignment } from '../match-assignments/entities/match-table-assignment.entity';
import { resolveSportConfig } from '../sports/sport-config';

/**
 * Glues persistent state to `@gsm/scheduler`:
 *   - resolves match duration + min-rest from SportConfig, allowing the
 *     tournament to override either field via `Tournament.sportConfig`,
 *   - collects pending matches from every active, unlocked bracket,
 *   - marks busy tables with the ETA of their active assignment,
 *   - seeds the scheduler's `athleteLastFinishAt` map from finished
 *     assignments so min-rest applies across the tournament, not just
 *     across matches scheduled in one call.
 *
 * Returned payload is public — the arena display / spectators can read it
 * without auth, so it intentionally contains no user-identifying data
 * beyond what's already in the public bracket.
 */
@Injectable()
export class ScheduleService {
  private logger = new Logger(ScheduleService.name);

  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Bracket)
    private readonly bracketsRepository: Repository<Bracket>,
    @InjectRepository(TournamentTable)
    private readonly tablesRepository: Repository<TournamentTable>,
    @InjectRepository(MatchTableAssignment)
    private readonly assignmentsRepository: Repository<MatchTableAssignment>,
  ) {}

  async getForTournament(tournamentId: string): Promise<SchedulerOutput> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
      relations: ['sport'],
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament #${tournamentId} not found`);
    }

    const baseConfig = resolveSportConfig(
      tournament.sport?.slug ?? '',
      (tournament.sport?.config ?? {}) as Partial<SportConfig>,
    );
    const override = tournament.sportConfig as Partial<SportConfig> | null;
    const avgMatchDurationSec =
      override?.avgMatchDurationSec ?? baseConfig.avgMatchDurationSec;
    const minRestBetweenMatchesSec =
      override?.minRestBetweenMatchesSec ?? baseConfig.minRestBetweenMatchesSec;

    const tables = await this.tablesRepository.find({
      where: { tournamentId },
      order: { number: 'ASC' },
    });
    const brackets = await this.bracketsRepository.find({
      where: { tournamentId },
      order: { createdAt: 'ASC' },
    });
    const allAssignments = await this.assignmentsRepository.find({
      where: { tournamentId },
    });

    const activeByTable = new Map<string, MatchTableAssignment>();
    const finished: MatchTableAssignment[] = [];
    for (const a of allAssignments) {
      if (a.finishedAt === null) activeByTable.set(a.tableId, a);
      else finished.push(a);
    }

    const now = new Date();
    const nowMs = now.getTime();
    const avgDurationMs = avgMatchDurationSec * 1000;

    // Tables the scheduler will see.
    const schedulerTables: SchedulerTable[] = tables.map((t) => {
      const active = activeByTable.get(t.id);
      if (active) {
        // ETA = startedAt + avg (fall back to assignedAt / now).
        const startedMs = active.startedAt
          ? new Date(active.startedAt).getTime()
          : active.assignedAt
            ? new Date(active.assignedAt).getTime()
            : nowMs;
        return {
          id: t.id,
          status: 'busy' as const,
          currentMatchEstimatedEndAt: startedMs + avgDurationMs,
        };
      }
      return { id: t.id, status: t.status };
    });

    // Pending matches in priority order. Priority = bracket creation order,
    // then bracket-engine section order (winners → losers → grand → super),
    // then within a round the engine's own match index. The caller-supplied
    // order is what the scheduler respects — it is sport-agnostic.
    const takenMatchIds = new Set(
      Array.from(activeByTable.values()).map((a) => a.matchId),
    );
    const schedulerMatches: SchedulerMatch[] = [];

    for (const b of brackets) {
      if (!b.bracketData || b.status !== 'active' || b.isLocked) continue;
      const data = b.bracketData as unknown as BracketData;

      const pushIfPlayable = (m: unknown) => {
        const mm = m as {
          id?: string;
          winner?: unknown;
          player1?: { id?: string };
          player2?: { id?: string };
        };
        if (!mm?.id || mm.winner) return;
        const p1 = mm.player1?.id;
        const p2 = mm.player2?.id;
        if (!p1 || !p2 || p1 === 'tbd' || p1 === 'bye' || p2 === 'tbd' || p2 === 'bye') return;
        if (takenMatchIds.has(mm.id)) return;
        schedulerMatches.push({
          matchId: mm.id,
          bracketId: b.id,
          athleteIds: [p1, p2],
        });
      };

      const visitRounds = (rounds: unknown[][]) => {
        for (const round of rounds) for (const m of round) pushIfPlayable(m);
      };

      visitRounds(data.winnersBracket as unknown as unknown[][]);
      visitRounds(data.losersBracket as unknown as unknown[][]);
      pushIfPlayable(data.grandFinal);
      if (data.superFinal?.needed) pushIfPlayable(data.superFinal);
    }

    // Build athleteLastFinishAt from closed assignments. For each finished
    // assignment we dig into the bracket data to get the match's athlete IDs,
    // then keep the max `finishedAt` per athlete.
    const bracketById = new Map(brackets.map((b) => [b.id, b]));
    const athleteLastFinishAt: Record<string, string> = {};

    for (const a of finished) {
      if (!a.finishedAt) continue;
      const bracket = bracketById.get(a.bracketId);
      if (!bracket?.bracketData) continue;
      const match = this.findMatchInBracket(
        bracket.bracketData as unknown as BracketData,
        a.matchId,
      );
      if (!match) continue;
      const finishedIso = new Date(a.finishedAt).toISOString();
      for (const athleteId of [match.player1?.id, match.player2?.id]) {
        if (!athleteId || athleteId === 'tbd' || athleteId === 'bye') continue;
        const prior = athleteLastFinishAt[athleteId];
        if (!prior || Date.parse(finishedIso) > Date.parse(prior)) {
          athleteLastFinishAt[athleteId] = finishedIso;
        }
      }
    }

    return buildSchedule({
      now,
      tables: schedulerTables,
      pendingMatches: schedulerMatches,
      avgMatchDurationSec,
      minRestBetweenMatchesSec,
      athleteLastFinishAt,
    });
  }

  /** Locate a match by id across every section of a BracketData blob. */
  private findMatchInBracket(
    data: BracketData,
    matchId: string,
  ): { player1?: { id?: string }; player2?: { id?: string } } | null {
    const scan = (m: unknown): boolean => {
      return (m as { id?: string } | null)?.id === matchId;
    };
    for (const round of data.winnersBracket) {
      for (const m of round) if (scan(m)) return m as never;
    }
    for (const round of data.losersBracket) {
      for (const m of round) if (scan(m)) return m as never;
    }
    if (scan(data.grandFinal)) return data.grandFinal as never;
    if (data.superFinal?.needed && scan(data.superFinal)) return data.superFinal as never;
    return null;
  }
}
