import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WeighIn } from './entities/weigh-in.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { fitsWeightCategory } from '../tournaments/weight-category.util';
import { EntriesService } from '../entries/entries.service';
import { resolveSportConfig } from '../sports/sport-config';

/**
 * Official on-site weigh-in lifecycle for `tournament_entries`.
 *
 * Gated by `SportConfig.weighInRequired` — calling `record` for a sport
 * whose config doesn't require weigh-ins is a 400. One row per entry:
 * re-weighing overwrites the previous measurement so downstream queries
 * ("has this entry been weighed?") stay a single lookup.
 *
 * If the official weight falls outside the entry's registered weight
 * category, the service attempts to reassign to a matching category via
 * `EntriesService.reassign`. If no matching category exists or the
 * bracket has already been generated (reassign would throw), the weigh-in
 * is still recorded — the admin UI surfaces the mismatch so a human can
 * resolve it with bracket slot replacement.
 */
@Injectable()
export class WeighInsService {
  private logger = new Logger(WeighInsService.name);

  constructor(
    @InjectRepository(WeighIn)
    private readonly weighInsRepository: Repository<WeighIn>,
    @InjectRepository(WeightCategory)
    private readonly weightCategoriesRepository: Repository<WeightCategory>,
    private readonly entriesService: EntriesService,
  ) {}

  /**
   * Record (or overwrite) the official weigh-in for an entry. Admin or
   * tournament organizer only. Auto-reassigns to a matching weight
   * category on mismatch (best-effort — see class docstring).
   */
  async record(
    entryId: string,
    officialWeightKg: number,
    actor: { userId: string; roles: string[] },
  ): Promise<WeighIn> {
    if (!(officialWeightKg > 0) || officialWeightKg > 500) {
      throw new BadRequestException('officialWeightKg must be between 0 and 500 kg');
    }

    const entry = await this.entriesService.findById(entryId);
    this.assertAdminOrOrganizer(entry, actor);

    if (entry.status !== 'confirmed' && entry.status !== 'checked_in') {
      throw new BadRequestException(
        `Cannot record a weigh-in for an entry in status '${entry.status}'`,
      );
    }

    const sportCfg = resolveSportConfig(
      entry.tournament.sport?.slug ?? '',
      (entry.tournament.sport?.config ?? null) as Parameters<typeof resolveSportConfig>[1],
    );
    if (!sportCfg.weighInRequired) {
      throw new BadRequestException(
        'This sport does not require a weigh-in',
      );
    }

    // Upsert by entryId (unique).
    const existing = await this.weighInsRepository.findOne({ where: { entryId } });
    const saved = existing
      ? await this.weighInsRepository.save({
          ...existing,
          officialWeightKg,
          verifiedBy: actor.userId,
          verifiedAt: new Date(),
        })
      : await this.weighInsRepository.save(
          this.weighInsRepository.create({
            entryId,
            tournamentId: entry.tournamentId,
            officialWeightKg,
            verifiedBy: actor.userId,
            verifiedAt: new Date(),
          }),
        );

    this.logger.log(
      `Weigh-in ${existing ? 'updated' : 'recorded'} for entry ${entryId}: ` +
        `${officialWeightKg} kg by ${actor.userId}`,
    );

    // Auto-reassign is best-effort — the weigh-in row above is the
    // source of truth and must persist even if reassignment fails (no
    // matching category, race with bracket generation, DB blip, …).
    // Swallow + log so the partial-write inconsistency is visible to
    // operators rather than rolled back from under them.
    try {
      await this.maybeAutoReassign(entry, officialWeightKg, actor);
    } catch (err) {
      this.logger.error(
        `Entry ${entryId}: weigh-in saved but auto-reassign failed — ` +
          `admin must reassign manually. ${(err as Error).message}`,
      );
    }

    return saved;
  }

  async findByEntryId(entryId: string): Promise<WeighIn | null> {
    return this.weighInsRepository.findOne({ where: { entryId } });
  }

  /**
   * Return the subset of `entryIds` that have NO weigh-in row. Used by
   * bracket generation to block when `SportConfig.weighInRequired` and
   * any confirmed entry is still unweighed. The caller is responsible
   * for looking up the sport config — this helper is a pure set
   * difference that works for any sport.
   */
  async findMissingForEntries(entryIds: string[]): Promise<string[]> {
    if (entryIds.length === 0) return [];
    const rows = await this.weighInsRepository.find({
      where: { entryId: In(entryIds) },
      select: ['entryId'],
    });
    const weighedIn = new Set(rows.map((r) => r.entryId));
    return entryIds.filter((id) => !weighedIn.has(id));
  }

  async findByTournamentId(tournamentId: string): Promise<WeighIn[]> {
    return this.weighInsRepository.find({
      where: { tournamentId },
      order: { verifiedAt: 'ASC' },
    });
  }

  /**
   * Delete a weigh-in row. Admin only — undoing an organizer's own
   * weigh-in is intentionally restricted so the audit trail can't be
   * quietly rewritten during the event.
   */
  async undo(
    id: string,
    actor: { userId: string; roles: string[] },
  ): Promise<void> {
    if (!actor.roles.includes('admin')) {
      throw new ForbiddenException('Only admin can undo a weigh-in');
    }
    const weighIn = await this.weighInsRepository.findOne({ where: { id } });
    if (!weighIn) throw new NotFoundException(`Weigh-in #${id} not found`);

    await this.weighInsRepository.delete(id);
    this.logger.log(`Weigh-in ${id} undone by ${actor.userId}`);
  }

  // ─── Internal ────────────────────────────────────────────

  private async maybeAutoReassign(
    entry: TournamentEntry,
    officialWeightKg: number,
    actor: { userId: string; roles: string[] },
  ): Promise<void> {
    // Nothing to do if the weight already fits the assigned category.
    if (entry.weightCategory && this.fitsCategory(officialWeightKg, entry.weightCategory)) {
      return;
    }

    // Reassign needs a pre-generation bracket; skip (and log) otherwise.
    if (entry.tournament.bracketGenerated) {
      this.logger.warn(
        `Entry ${entry.id}: weigh-in mismatch but bracket already generated — ` +
          `manual slot replacement required`,
      );
      return;
    }

    // We can only confidently auto-reassign when we know the target
    // category's gender. `WeightCategory` carries a `gender` column, but
    // it has no `ageGroup` / `hand` columns — yet tournaments routinely
    // create separate categories per (ageGroup, hand, weight) combo
    // (e.g. armwrestling). Without those columns we cannot safely
    // disambiguate when more than one category matches; bail out and
    // let an admin handle it manually.
    if (!entry.weightCategory) {
      this.logger.warn(
        `Entry ${entry.id}: weigh-in mismatch but entry has no current ` +
          `weight category — admin must assign one manually`,
      );
      return;
    }

    const categories = await this.weightCategoriesRepository.find({
      where: { tournamentId: entry.tournamentId },
    });
    const candidates = categories.filter(
      (c) =>
        c.gender === entry.weightCategory!.gender &&
        this.fitsCategory(officialWeightKg, c),
    );

    if (candidates.length === 0) {
      this.logger.warn(
        `Entry ${entry.id}: weigh-in ${officialWeightKg}kg has no matching ` +
          `weight category in tournament ${entry.tournamentId} — left on current category`,
      );
      return;
    }
    if (candidates.length > 1) {
      // Multiple categories share gender + weight band but differ by
      // ageGroup / hand (encoded only in `WeightCategory.name` today).
      // Auto-reassign cannot pick the right one without those columns;
      // surface to the admin instead of silently misrouting.
      this.logger.warn(
        `Entry ${entry.id}: weigh-in ${officialWeightKg}kg matches ` +
          `${candidates.length} categories (${candidates.map((c) => c.name).join(', ')}) — ` +
          `cannot disambiguate without ageGroup/hand on WeightCategory; admin must reassign manually`,
      );
      return;
    }

    const target = candidates[0];
    if (target.id === entry.weightCategoryId) return;

    await this.entriesService.reassign(
      entry.id,
      {
        weightCategoryId: target.id,
        weightKg: officialWeightKg,
        reason: `auto-reassign on weigh-in: official ${officialWeightKg}kg`,
      },
      actor,
    );
    this.logger.log(
      `Entry ${entry.id} auto-reassigned from ${entry.weightCategoryId ?? '(none)'} ` +
        `to ${target.id} on weigh-in mismatch`,
    );
  }

  private fitsCategory(weight: number, c: WeightCategory): boolean {
    return fitsWeightCategory(weight, c);
  }

  private assertAdminOrOrganizer(
    entry: TournamentEntry,
    actor: { userId: string; roles: string[] },
  ): void {
    const isAdmin = actor.roles.includes('admin');
    const isOrganizer = entry.tournament?.organizerId === actor.userId;
    if (!isAdmin && !isOrganizer) {
      throw new ForbiddenException(
        'Only the tournament organizer or admin can record weigh-ins',
      );
    }
  }
}
