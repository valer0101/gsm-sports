import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { findMatch } from '@gsm/bracket-engine';
import type { BracketData } from '@gsm/bracket-engine';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Bracket } from '../brackets/entities/bracket.entity';
import { TournamentTable } from '../tournaments/entities/tournament-table.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { ScheduleService } from '../schedule/schedule.service';
import { TelegramNotificationsService } from './telegram-notifications.service';

/**
 * Periodic job: for every tournament currently in an active state, ask
 * the scheduler what matches are coming up in the 15-min window and push
 * a Telegram reminder to both athletes (those who've linked).
 *
 * Cron cadence: every minute. Dedupe is handled at the DB layer inside
 * `TelegramNotificationsService.notifyMatchReminder` via the UNIQUE
 * `(tournament, match, kind)` constraint, so the cron is safe to run
 * overlapping / missed-tick.
 *
 * The whole tick is wrapped in try/catch — a single bad tournament
 * must not prevent the others from being processed, and a stray throw
 * must not kill the Nest-schedule worker for this process lifetime.
 */
@Injectable()
export class MatchReminderTask {
  private logger = new Logger(MatchReminderTask.name);

  /**
   * Reminder window: matches whose projected start is in
   * `[ now, now + 15 min ]` get a reminder, once.
   */
  private static readonly WINDOW_START_SEC = 0;
  private static readonly WINDOW_END_SEC = 15 * 60;

  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Bracket)
    private readonly bracketsRepository: Repository<Bracket>,
    @InjectRepository(TournamentTable)
    private readonly tablesRepository: Repository<TournamentTable>,
    @InjectRepository(TournamentEntry)
    private readonly entriesRepository: Repository<TournamentEntry>,
    private readonly scheduleService: ScheduleService,
    private readonly notifications: TelegramNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'telegram-match-reminders' })
  async tick(): Promise<void> {
    try {
      const activeTournaments = await this.tournamentsRepository.find({
        where: [{ status: 'active' }, { status: 'bracket_ready' }],
      });

      for (const t of activeTournaments) {
        try {
          await this.processTournament(t.id);
        } catch (err) {
          this.logger.warn(
            `reminder tick: tournament ${t.id} failed: ${(err as Error)?.message ?? 'unknown'}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `reminder tick outer failure: ${(err as Error)?.message ?? 'unknown'}`,
      );
    }
  }

  private async processTournament(tournamentId: string): Promise<void> {
    const schedule = await this.scheduleService.getForTournament(tournamentId);

    const nowMs = Date.now();
    const windowStartMs = nowMs + MatchReminderTask.WINDOW_START_SEC * 1000;
    const windowEndMs = nowMs + MatchReminderTask.WINDOW_END_SEC * 1000;

    // Filter scheduled matches to those about to start within the window.
    // Already-running matches are in `active`, not `scheduled`, so they
    // won't show up here — by construction.
    const due = schedule.scheduled.filter(
      (s) => s.estimatedStartAt >= windowStartMs && s.estimatedStartAt <= windowEndMs,
    );
    if (due.length === 0) return;

    // Preload the brackets + tables + entries we'll need to resolve
    // matchIds → athlete user ids + human names. `weightCategory` is
    // eager-joined so reminder messages include the category label
    // ("Men · 80kg · right"); without it the message falls back to a
    // bare `bracket.name` which is usually null.
    const brackets = await this.bracketsRepository.find({
      where: { tournamentId },
      relations: ['weightCategory'],
    });
    const bracketById = new Map(brackets.map((b) => [b.id, b]));

    const tables = await this.tablesRepository.find({ where: { tournamentId } });
    const tableNumberById = new Map(tables.map((t) => [t.id, t.number]));

    // Collect all entry ids referenced by due matches so we can batch
    // the entry lookup into one query instead of N per match.
    const entryIds = new Set<string>();
    for (const s of due) {
      const bracket = bracketById.get(s.bracketId);
      if (!bracket?.bracketData) continue;
      const match = findMatch(bracket.bracketData as unknown as BracketData, s.matchId);
      if (!match) continue;
      if (match.player1?.id) entryIds.add(match.player1.id);
      if (match.player2?.id) entryIds.add(match.player2.id);
    }
    if (entryIds.size === 0) return;

    const entries = await this.entriesRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .where('e.id IN (:...ids)', { ids: Array.from(entryIds) })
      .getMany();
    const entryById = new Map(entries.map((e) => [e.id, e]));

    for (const s of due) {
      const bracket = bracketById.get(s.bracketId);
      if (!bracket?.bracketData) continue;
      const match = findMatch(bracket.bracketData as unknown as BracketData, s.matchId);
      if (!match) continue;

      const e1 = entryById.get(match.player1?.id ?? '');
      const e2 = entryById.get(match.player2?.id ?? '');
      const userIds: string[] = [];
      if (e1?.userId) userIds.push(e1.userId);
      if (e2?.userId) userIds.push(e2.userId);
      if (userIds.length === 0) continue;

      const opponentNames: Record<string, string> = {};
      if (e1?.userId && e2?.user) {
        opponentNames[e1.userId] =
          `${e2.user.firstName ?? ''} ${e2.user.lastName ?? ''}`.trim();
      }
      if (e2?.userId && e1?.user) {
        opponentNames[e2.userId] =
          `${e1.user.firstName ?? ''} ${e1.user.lastName ?? ''}`.trim();
      }

      const minutesUntilStart = Math.max(
        1,
        Math.round((s.estimatedStartAt - nowMs) / 60_000),
      );
      const tableNumber = tableNumberById.get(s.tableId) ?? 0;
      const categoryLabel = bracket.weightCategory?.name ?? bracket.name ?? null;

      await this.notifications.notifyMatchReminder({
        tournamentId,
        matchId: s.matchId,
        athleteUserIds: userIds,
        tableNumber,
        minutesUntilStart,
        categoryLabel,
        opponentNames,
      });
    }
  }
}
