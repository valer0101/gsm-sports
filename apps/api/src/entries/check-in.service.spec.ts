import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CheckInService } from './check-in.service';
import { TournamentEntry } from './entities/tournament-entry.entity';

const mockRepo = () => ({
  findOne: vi.fn(),
  update: vi.fn(),
});

const mockJwt = () => ({
  sign: vi.fn(() => 'signed.jwt.token'),
  verify: vi.fn(),
});

const mockConfig = () => ({
  get: vi.fn((key: string, def: string) => def),
});

const makeEntry = (overrides: Partial<TournamentEntry> = {}): TournamentEntry =>
  ({
    id: 'entry-1',
    tournamentId: 'tournament-1',
    userId: 'athlete-1',
    status: 'confirmed',
    checkedInAt: null,
    checkedInBy: null,
    tournament: { id: 'tournament-1', organizerId: 'organizer-1' },
    ...overrides,
  }) as TournamentEntry;

describe('CheckInService', () => {
  let service: CheckInService;
  let repo: ReturnType<typeof mockRepo>;
  let jwt: ReturnType<typeof mockJwt>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CheckInService,
        { provide: getRepositoryToken(TournamentEntry), useFactory: mockRepo },
        { provide: JwtService, useFactory: mockJwt },
        { provide: ConfigService, useFactory: mockConfig },
      ],
    }).compile();

    service = module.get(CheckInService);
    repo = module.get(getRepositoryToken(TournamentEntry));
    jwt = module.get(JwtService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('issueQrToken', () => {
    it('signs a token for the entry owner', async () => {
      repo.findOne.mockResolvedValue(makeEntry());

      const result = await service.issueQrToken('entry-1', 'athlete-1');

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          entryId: 'entry-1',
          tournamentId: 'tournament-1',
          purpose: 'checkin',
        }),
        expect.objectContaining({ expiresIn: expect.any(Number) }),
      );
      expect(result.token).toBe('signed.jwt.token');
      expect(result.expiresAt).toEqual(expect.any(String));
    });

    it('rejects a token request from a non-owner', async () => {
      repo.findOne.mockResolvedValue(makeEntry());

      await expect(
        service.issueQrToken('entry-1', 'someone-else'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects issuing for withdrawn entries', async () => {
      repo.findOne.mockResolvedValue(makeEntry({ status: 'withdrawn' }));

      await expect(
        service.issueQrToken('entry-1', 'athlete-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown entry', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.issueQrToken('missing', 'athlete-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkInByToken', () => {
    it('flips the entry to checked_in when token is valid', async () => {
      jwt.verify.mockReturnValue({
        entryId: 'entry-1',
        tournamentId: 'tournament-1',
        purpose: 'checkin',
      });
      repo.findOne
        .mockResolvedValueOnce(makeEntry()) // tournamentId guard
        .mockResolvedValueOnce(makeEntry()) // performCheckIn → findEntry
        .mockResolvedValueOnce(makeEntry({ status: 'checked_in' })); // return

      const result = await service.checkInByToken('token', 'organizer-1', []);

      expect(repo.update).toHaveBeenCalledWith(
        'entry-1',
        expect.objectContaining({
          status: 'checked_in',
          checkedInBy: 'organizer-1',
          checkedInAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe('checked_in');
    });

    it('rejects an expired/invalid token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.checkInByToken('bad', 'organizer-1', []),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a token with wrong purpose (replay of an access token)', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });

      await expect(
        service.checkInByToken('access-token', 'organizer-1', []),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when actor is neither admin nor the tournament organizer', async () => {
      jwt.verify.mockReturnValue({
        entryId: 'entry-1',
        tournamentId: 'tournament-1',
        purpose: 'checkin',
      });
      repo.findOne.mockResolvedValue(makeEntry());

      await expect(
        service.checkInByToken('token', 'random-user', []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin bypass even when not the organizer', async () => {
      jwt.verify.mockReturnValue({
        entryId: 'entry-1',
        tournamentId: 'tournament-1',
        purpose: 'checkin',
      });
      repo.findOne
        .mockResolvedValueOnce(makeEntry()) // tournamentId guard
        .mockResolvedValueOnce(makeEntry()) // performCheckIn → findEntry
        .mockResolvedValueOnce(makeEntry({ status: 'checked_in' }));

      await service.checkInByToken('token', 'admin-user', ['admin']);

      expect(repo.update).toHaveBeenCalled();
    });

    it('is idempotent — already-checked-in entry returns without re-writing', async () => {
      jwt.verify.mockReturnValue({
        entryId: 'entry-1',
        tournamentId: 'tournament-1',
        purpose: 'checkin',
      });
      repo.findOne.mockResolvedValue(makeEntry({ status: 'checked_in' }));

      const result = await service.checkInByToken('token', 'organizer-1', []);

      expect(result.status).toBe('checked_in');
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('rejects check-in for withdrawn entry even with valid token', async () => {
      jwt.verify.mockReturnValue({
        entryId: 'entry-1',
        tournamentId: 'tournament-1',
        purpose: 'checkin',
      });
      repo.findOne.mockResolvedValue(makeEntry({ status: 'withdrawn' }));

      await expect(
        service.checkInByToken('token', 'organizer-1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects stale token whose tournamentId no longer matches the entry', async () => {
      jwt.verify.mockReturnValue({
        entryId: 'entry-1',
        tournamentId: 'tournament-OLD',
        purpose: 'checkin',
      });
      repo.findOne.mockResolvedValue(makeEntry({ tournamentId: 'tournament-1' }));

      await expect(
        service.checkInByToken('token', 'organizer-1', []),
      ).rejects.toThrow(UnauthorizedException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('production secret guard', () => {
    it('refuses to start in production if JWT_CHECKIN_SECRET is not explicitly set', async () => {
      const prodConfig = {
        get: vi.fn((key: string, def?: string) => {
          if (key === 'JWT_CHECKIN_SECRET') return undefined;
          if (key === 'NODE_ENV') return 'production';
          return def;
        }),
      };

      await expect(
        Test.createTestingModule({
          providers: [
            CheckInService,
            { provide: getRepositoryToken(TournamentEntry), useFactory: mockRepo },
            { provide: JwtService, useFactory: mockJwt },
            { provide: ConfigService, useValue: prodConfig },
          ],
        }).compile(),
      ).rejects.toThrow(/JWT_CHECKIN_SECRET must be set in production/);
    });

    it('accepts the derived fallback in non-production', async () => {
      const devConfig = {
        get: vi.fn((key: string, def?: string) => {
          if (key === 'JWT_CHECKIN_SECRET') return undefined;
          if (key === 'NODE_ENV') return 'development';
          return def;
        }),
      };

      await expect(
        Test.createTestingModule({
          providers: [
            CheckInService,
            { provide: getRepositoryToken(TournamentEntry), useFactory: mockRepo },
            { provide: JwtService, useFactory: mockJwt },
            { provide: ConfigService, useValue: devConfig },
          ],
        }).compile(),
      ).resolves.toBeDefined();
    });
  });

  describe('checkInManual', () => {
    it('allows organizer to manually check in a confirmed entry', async () => {
      repo.findOne
        .mockResolvedValueOnce(makeEntry())
        .mockResolvedValueOnce(makeEntry({ status: 'checked_in' }));

      const result = await service.checkInManual('entry-1', 'organizer-1', []);
      expect(repo.update).toHaveBeenCalled();
      expect(result.status).toBe('checked_in');
    });

    it('rejects non-admin non-organizer', async () => {
      repo.findOne.mockResolvedValue(makeEntry());
      await expect(
        service.checkInManual('entry-1', 'random', []),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('undoCheckIn', () => {
    it('admin can undo a check-in', async () => {
      repo.findOne
        .mockResolvedValueOnce(makeEntry({ status: 'checked_in', checkedInBy: 'x' }))
        .mockResolvedValueOnce(makeEntry({ status: 'confirmed' }));

      const result = await service.undoCheckIn('entry-1', 'admin-user', ['admin']);

      expect(repo.update).toHaveBeenCalledWith(
        'entry-1',
        expect.objectContaining({ status: 'confirmed', checkedInAt: null, checkedInBy: null }),
      );
      expect(result.status).toBe('confirmed');
    });

    it('organizer (non-admin) cannot undo — admin-only guard', async () => {
      repo.findOne.mockResolvedValue(
        makeEntry({ status: 'checked_in' }),
      );

      await expect(
        service.undoCheckIn('entry-1', 'organizer-1', []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects undo for entries that are not currently checked in', async () => {
      repo.findOne.mockResolvedValue(makeEntry({ status: 'confirmed' }));
      await expect(
        service.undoCheckIn('entry-1', 'admin-user', ['admin']),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
