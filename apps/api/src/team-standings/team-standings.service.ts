import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { getFinalPlacements } from '@gsm/bracket-engine';
import type { BracketData, FinalPlacement } from '@gsm/bracket-engine';
import type {
  TeamScoringConfig,
  TeamStandingsResponse,
  TeamStandingsRow,
} from '@gsm/shared-types';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Bracket } from '../brackets/entities/bracket.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { resolveSportConfig } from '../sports/sport-config';

/**
 * Aggregates `getFinalPlacements()` from every bracket of a tournament
 * into a country-level leaderboard (Phase 3.4 — team standings).
 *
 * The "team" axis is the athlete's country, snapshotted on
 * `TournamentEntry.athleteCountry` at registration time (see migration
 * 1776200000000) so historical results stay stable if the athlete's
 * profile country changes after the event.
 *
 * Scoring is configurable via `SportConfig.teamScoring.pointsByPlace`
 * (resolved per-tournament, falls back to WAF-style 7/5/3/1). Missing
 * positions score 0 — only finishers covered by the scheme contribute.
 *
 * Public read — the spectator/arena view fetches without auth, so the
 * payload contains no PII beyond what the bracket already exposes
 * (userId of each placement, since brackets render names publicly).
 */
@Injectable()
export class TeamStandingsService {
  private logger = new Logger(TeamStandingsService.name);

  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Bracket)
    private readonly bracketsRepository: Repository<Bracket>,
    @InjectRepository(TournamentEntry)
    private readonly entriesRepository: Repository<TournamentEntry>,
  ) {}

  async getForTournament(tournamentId: string): Promise<TeamStandingsResponse> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id: tournamentId },
      relations: ['sport'],
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament #${tournamentId} not found`);
    }

    const sportSlug = tournament.sport?.slug ?? '';
    const sportLevel = resolveSportConfig(
      sportSlug,
      tournament.sport?.config as Parameters<typeof resolveSportConfig>[1],
    );
    // Tournament-level override wins over sport-level default. Only the
    // teamScoring sub-object is overridden here — other fields come from
    // the resolved sport config.
    const tournamentOverride =
      (tournament.sportConfig as { teamScoring?: TeamScoringConfig } | null)?.teamScoring;
    const teamScoring = tournamentOverride ?? sportLevel.teamScoring;
    const pointsByPlace = teamScoring.pointsByPlace ?? {};

    const brackets = await this.bracketsRepository.find({
      where: { tournamentId },
    });
    if (brackets.length === 0) {
      return { tournamentId, pointsByPlace, rows: [] };
    }

    // Walk every bracket, collect placements that score points. Anything
    // outside `pointsByPlace` is dropped here so we don't even need to
    // load entries for non-scoring positions — keeps the join small for
    // 200-athlete events.
    type ScoringPlacement = {
      bracketId: string;
      bracketName: string | null;
      entryId: string;
      placement: number;
      points: number;
    };
    const scoring: ScoringPlacement[] = [];
    for (const bracket of brackets) {
      const data = bracket.bracketData as BracketData | null;
      if (!data) continue;
      const placements: FinalPlacement[] = getFinalPlacements(data);
      for (const p of placements) {
        const points = pointsByPlace[p.position];
        if (!points || points <= 0) continue;
        scoring.push({
          bracketId: bracket.id,
          bracketName: bracket.name,
          entryId: p.playerId,
          placement: p.position,
          points,
        });
      }
    }

    if (scoring.length === 0) {
      return { tournamentId, pointsByPlace, rows: [] };
    }

    const entryIds = Array.from(new Set(scoring.map((s) => s.entryId)));
    const entries = await this.entriesRepository.find({
      where: { id: In(entryIds) },
      select: ['id', 'userId', 'athleteCountry'],
    });
    const entryById = new Map(entries.map((e) => [e.id, e]));

    // Group by country. Skip placements whose entry can't be found (slot
    // edits, manual cleanups) or whose athlete has no country recorded
    // — they don't contribute to a team but were already filtered out
    // by `pointsByPlace`-zero above where applicable.
    //
    // `userId` is tracked only inside this method to count distinct
    // athletes; it is intentionally NOT included in the wire shape.
    // The public `@Public()` brackets payload never exposes user UUIDs
    // (it carries entry ids as `Player.id`), and this public endpoint
    // must not be the path that lets unauthenticated clients pivot a
    // tournament listing to specific user UUIDs.
    const teamMap = new Map<
      string,
      {
        team: string;
        points: number;
        athletes: Set<string>;
        breakdown: TeamStandingsRow['breakdown'];
      }
    >();
    for (const s of scoring) {
      const entry = entryById.get(s.entryId);
      if (!entry) continue;
      const team = entry.athleteCountry;
      if (!team) continue;
      let row = teamMap.get(team);
      if (!row) {
        row = { team, points: 0, athletes: new Set(), breakdown: [] };
        teamMap.set(team, row);
      }
      row.points += s.points;
      row.athletes.add(entry.userId);
      row.breakdown.push({
        bracketId: s.bracketId,
        category: s.bracketName,
        entryId: entry.id,
        placement: s.placement,
        points: s.points,
      });
    }

    const rows = Array.from(teamMap.values())
      .map<TeamStandingsRow>((r) => ({
        team: r.team,
        position: 0, // assigned below
        points: r.points,
        athletesScoring: r.athletes.size,
        // Stable display order: best placement first, then bracket id.
        // Use raw UTF-16 comparison instead of `localeCompare` — the
        // host-locale dependency of the latter breaks output determinism
        // across Node builds (same fix as PR #16 / `3b92517` for the
        // scheduler tableId tie-break).
        breakdown: r.breakdown.sort(
          (a, b) =>
            a.placement - b.placement ||
            (a.bracketId < b.bracketId ? -1 : a.bracketId > b.bracketId ? 1 : 0),
        ),
      }))
      // Points desc; ties broken by athletesScoring desc (depth of roster
      // — a country whose 4 athletes each scored once outranks one whose
      // single athlete won 4 categories), then raw alpha for cross-host
      // determinism.
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.athletesScoring - a.athletesScoring ||
          (a.team < b.team ? -1 : a.team > b.team ? 1 : 0),
      );

    // Competition ranking: tied rows share position; next position skips.
    let pos = 0;
    let lastKey = '';
    rows.forEach((row, idx) => {
      const key = `${row.points}|${row.athletesScoring}`;
      if (key !== lastKey) {
        pos = idx + 1;
        lastKey = key;
      }
      row.position = pos;
    });

    return { tournamentId, pointsByPlace, rows };
  }
}
