import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TournamentEntry, EntryStatus } from './entities/tournament-entry.entity';

/**
 * Check-in lifecycle for tournament_entries.
 *
 * Flow:
 *   1. Athlete (owner of the entry) hits GET /:id/checkin-qr and receives a
 *      signed JWT — embedded in a QR code by the frontend.
 *   2. On event day, admin / organizer scans the QR → POST /check-in-by-qr
 *      with the token. Server verifies signature + purpose + expiry, flips
 *      the entry to `checked_in` and records `checked_in_by` / `_at`.
 *   3. Manual path: admin / organizer can check in an athlete directly via
 *      POST /:id/check-in (no QR) for kiosks / walk-ups.
 *   4. Admin-only undo reverts to `confirmed`.
 *
 * A separate secret (`JWT_CHECKIN_SECRET`, falling back to
 * `JWT_ACCESS_SECRET + '-checkin'`) signs check-in tokens so a leaked QR
 * cannot be mistaken for a session token and vice-versa.
 */
@Injectable()
export class CheckInService {
  private logger = new Logger(CheckInService.name);
  private readonly checkInSecret: string;
  /** Default TTL in seconds — 30 days covers any realistic tournament horizon. */
  private readonly tokenTtlSeconds = 60 * 60 * 24 * 30;

  constructor(
    @InjectRepository(TournamentEntry)
    private readonly entriesRepository: Repository<TournamentEntry>,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    const access = config.get<string>(
      'JWT_ACCESS_SECRET',
      'dev-access-secret-change-in-prod',
    );
    this.checkInSecret = config.get<string>('JWT_CHECKIN_SECRET', `${access}-checkin`);
  }

  // ─── QR issue ──────────────────────────────────────────────

  /**
   * The athlete (owner of the entry) issues their own check-in QR token.
   * Organizers / admins cannot issue tokens on behalf of someone else — that
   * would defeat the purpose of "show me your QR at the gate".
   */
  async issueQrToken(entryId: string, userId: string): Promise<{ token: string; expiresAt: string }> {
    const entry = await this.findEntry(entryId);

    if (entry.userId !== userId) {
      throw new ForbiddenException('You can only issue a check-in QR for your own registration');
    }
    if (entry.status === 'withdrawn' || entry.status === 'rejected') {
      throw new BadRequestException(
        `Cannot issue QR for ${entry.status} registration`,
      );
    }

    const expiresAt = new Date(Date.now() + this.tokenTtlSeconds * 1000);
    const token = this.jwtService.sign(
      {
        entryId: entry.id,
        tournamentId: entry.tournamentId,
        purpose: 'checkin',
      },
      { secret: this.checkInSecret, expiresIn: this.tokenTtlSeconds },
    );
    return { token, expiresAt: expiresAt.toISOString() };
  }

  // ─── Check-in paths ────────────────────────────────────────

  /** QR-scan path. Verifies the token, then delegates to the core flip. */
  async checkInByToken(
    token: string,
    actorId: string,
    actorRoles: string[],
  ): Promise<TournamentEntry> {
    let payload: { entryId?: string; tournamentId?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token, { secret: this.checkInSecret });
    } catch {
      throw new UnauthorizedException('Check-in token is invalid or expired');
    }

    if (payload.purpose !== 'checkin' || !payload.entryId) {
      throw new UnauthorizedException('Check-in token has wrong shape');
    }

    return this.performCheckIn(payload.entryId, actorId, actorRoles);
  }

  /** Manual path — admin / organizer presses a button, no QR. */
  async checkInManual(
    entryId: string,
    actorId: string,
    actorRoles: string[],
  ): Promise<TournamentEntry> {
    return this.performCheckIn(entryId, actorId, actorRoles);
  }

  /** Admin-only undo — returns entry to `confirmed`. */
  async undoCheckIn(
    entryId: string,
    actorId: string,
    actorRoles: string[],
  ): Promise<TournamentEntry> {
    const entry = await this.findEntry(entryId);
    this.assertAdminOrOrganizer(entry, actorId, actorRoles, { requireAdmin: true });

    if (entry.status !== 'checked_in') {
      throw new BadRequestException('Entry is not currently checked in');
    }

    await this.entriesRepository.update(entryId, {
      status: 'confirmed' as EntryStatus,
      checkedInAt: null,
      checkedInBy: null,
    });
    this.logger.log(`Entry ${entryId} check-in undone by ${actorId}`);
    return this.findEntry(entryId);
  }

  // ─── Internal ──────────────────────────────────────────────

  private async performCheckIn(
    entryId: string,
    actorId: string,
    actorRoles: string[],
  ): Promise<TournamentEntry> {
    const entry = await this.findEntry(entryId);
    this.assertAdminOrOrganizer(entry, actorId, actorRoles);

    if (entry.status === 'checked_in') {
      // Idempotent: return current state without a second write. The UI treats
      // this as a success ("already checked in") rather than an error.
      return entry;
    }
    if (entry.status !== 'pending' && entry.status !== 'confirmed') {
      throw new BadRequestException(
        `Cannot check in an entry in status '${entry.status}'`,
      );
    }

    await this.entriesRepository.update(entryId, {
      status: 'checked_in' as EntryStatus,
      checkedInAt: new Date(),
      checkedInBy: actorId,
    });
    this.logger.log(`Entry ${entryId} checked in by ${actorId}`);
    return this.findEntry(entryId);
  }

  private async findEntry(id: string): Promise<TournamentEntry> {
    const entry = await this.entriesRepository.findOne({
      where: { id },
      relations: ['user', 'tournament'],
    });
    if (!entry) throw new NotFoundException(`Entry #${id} not found`);
    return entry;
  }

  private assertAdminOrOrganizer(
    entry: TournamentEntry,
    actorId: string,
    actorRoles: string[],
    opts: { requireAdmin?: boolean } = {},
  ): void {
    const isAdmin = actorRoles.includes('admin');
    const isOrganizer = entry.tournament?.organizerId === actorId;

    if (opts.requireAdmin && !isAdmin) {
      throw new ForbiddenException('Only admin can perform this action');
    }
    if (!isAdmin && !isOrganizer) {
      throw new ForbiddenException(
        'Only the tournament organizer or admin can check in entries',
      );
    }
  }
}
