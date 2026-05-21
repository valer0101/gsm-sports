import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BracketsService } from './brackets.service';
import { Bracket } from './entities/bracket.entity';
import { BracketAuditLog } from './entities/bracket-audit-log.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { TournamentsService } from '../tournaments/tournaments.service';
import { EntriesService } from '../entries/entries.service';
import { EventsGateway } from '../events/events.gateway';
import { MatchAssignmentsService } from '../match-assignments/match-assignments.service';
import { TelegramNotificationsService } from '../telegram/telegram-notifications.service';
import { WeighInsService } from '../weigh-ins/weigh-ins.service';

vi.mock('@gsm/bracket-engine', () => ({
  generateDoubleElimination: vi.fn(() => ({
    format: 'double_elim',
    players: [],
    bracketSize: 4,
    wbRounds: 2,
    winnersBracket: [],
    losersBracket: [],
    grandFinal: { id: 'grand_final' },
    superFinal: { id: 'super_final', needed: false },
    champion: null,
    status: 'active',
  })),
  generateSingleElimination: vi.fn(() => ({
    format: 'single_elim',
    players: [],
    bracketSize: 4,
    wbRounds: 2,
    winnersBracket: [],
    losersBracket: [],
    grandFinal: { id: 'grand_final' },
    superFinal: { id: 'super_final', needed: false },
    champion: null,
    status: 'active',
  })),
  generateRoundRobin: vi.fn(() => ({
    format: 'round_robin',
    players: [],
    bracketSize: 4,
    wbRounds: 3,
    winnersBracket: [],
    losersBracket: [],
    grandFinal: { id: 'grand_final' },
    superFinal: { id: 'super_final', needed: false },
    champion: null,
    status: 'active',
  })),
  generateSwiss: vi.fn(() => ({
    format: 'swiss',
    players: [],
    bracketSize: 4,
    wbRounds: 2,
    winnersBracket: [],
    losersBracket: [],
    grandFinal: { id: 'grand_final' },
    superFinal: { id: 'super_final', needed: false },
    champion: null,
    status: 'active',
  })),
  generateGroupsPlayoff: vi.fn(() => ({
    format: 'groups_playoff',
    players: [],
    bracketSize: 4,
    wbRounds: 2,
    winnersBracket: [],
    losersBracket: [],
    grandFinal: { id: 'grand_final' },
    superFinal: { id: 'super_final', needed: false },
    groups: [],
    champion: null,
    status: 'active',
  })),
  generateArmfight: vi.fn(() => ({
    format: 'armfight',
    players: [],
    bracketSize: 2,
    wbRounds: 1,
    winnersBracket: [
      [
        {
          id: 'wb_1_0',
          round: 1,
          matchIndex: 0,
          player1: { id: 'p1', firstName: 'A', lastName: 'B', number: 1 },
          player2: { id: 'p2', firstName: 'C', lastName: 'D', number: 2 },
          winner: null,
          loser: null,
        },
      ],
    ],
    losersBracket: [],
    grandFinal: { id: 'grand_final' },
    superFinal: { id: 'super_final', needed: false },
    champion: null,
    status: 'active',
  })),
  selectWinner: vi.fn((data: any) => ({ ...data, status: 'active' })),
  resetMatch: vi.fn((data: any) => ({ ...data, status: 'active' })),
  validateResult: vi.fn(() => ({ valid: true, errors: [] })),
  canRecordResult: vi.fn(() => ({ valid: true, errors: [] })),
  findMatch: vi.fn((_data: any, matchId: string) => ({
    id: matchId,
    player1: { id: 'p1', firstName: 'A', lastName: 'B', number: 1 },
    player2: { id: 'p2', firstName: 'C', lastName: 'D', number: 2 },
    winner: null,
    loser: null,
  })),
  replacePlayerInSlot: vi.fn(() => ({ ok: true })),
  withdrawPlayerFromSlot: vi.fn(() => ({ ok: true, forfeitTo: 'p2' })),
  recordLeg: vi.fn(),
  forfeitBout: vi.fn((data: any, boutId: string, winnerId: string) => {
    // Minimal: flip status to walkover so listBouts has something to show after forfeit.
    const m = data.winnersBracket[0].find((mm: any) => mm.id === boutId);
    if (m) {
      m.winner = winnerId;
      if (m.result) m.result.status = 'walkover';
    }
  }),
  getBoutScore: vi.fn((_data: any, _id: string) => ({
    a: 0,
    b: 0,
    status: 'pending' as const,
    leadingId: null,
  })),
  propagateResults: vi.fn(),
  isArmfightBoutResult: vi.fn((x: unknown) => {
    if (!x || typeof x !== 'object') return false;
    const r = x as Record<string, unknown>;
    if (typeof r.hand !== 'string' || (r.hand !== 'left' && r.hand !== 'right')) return false;
    if (!Array.isArray(r.legs)) return false;
    if (typeof r.scoreA !== 'number' || typeof r.scoreB !== 'number') return false;
    if (typeof r.status !== 'string') return false;
    return true;
  }),
}));

// Builder that mimics TypeORM's createQueryBuilder().update().set().where().execute()
function makeUpdateQB(affected: number = 1) {
  const qb: any = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ affected }),
  };
  return qb;
}

const mockRepo = () => ({
  findOne: vi.fn(),
  find: vi.fn(),
  create: vi.fn((x) => x),
  save: vi.fn((x) => Promise.resolve(x)),
  update: vi.fn(),
  createQueryBuilder: vi.fn(() => makeUpdateQB(1)),
});

const mockOperatorsRepo = () => ({ count: vi.fn().mockResolvedValue(0) });
const mockAuditRepo = () => ({ create: vi.fn((x) => x), save: vi.fn(), find: vi.fn() });

const mockTournamentsService = () => ({ findById: vi.fn() });
const mockEntriesService = () => ({
  findByTournament: vi.fn(),
  findByGroup: vi.fn(),
  findByIds: vi.fn(),
});

const makeTournament = (overrides = {}) => ({
  id: 'tournament-1',
  organizerId: 'org-1',
  ...overrides,
});

const makeBracket = (overrides: any = {}) => ({
  id: 'bracket-1',
  tournamentId: 'tournament-1',
  weightCategoryId: null,
  status: 'active' as const,
  bracketData: { status: 'active', players: [], winnersBracket: [], losersBracket: [] },
  tournament: makeTournament(),
  weightCategory: null,
  isLocked: false,
  lastModifiedBy: null,
  lastModifiedAt: null,
  modificationCount: 0,
  completedAt: null,
  ...overrides,
});

const makeEntry = (userId: string) => ({
  id: `entry-${userId}`,
  userId,
  user: { firstName: 'Player', lastName: userId },
  seedNumber: null,
});

describe('BracketsService', () => {
  let service: BracketsService;
  let repo: ReturnType<typeof mockRepo>;
  let auditRepo: ReturnType<typeof mockAuditRepo>;
  let operatorsRepo: ReturnType<typeof mockOperatorsRepo>;
  let tournamentsService: ReturnType<typeof mockTournamentsService>;
  let entriesService: ReturnType<typeof mockEntriesService>;
  let eventsGateway: { emitBracketUpdate: ReturnType<typeof vi.fn> };
  let weighInsService: { findMissingForEntries: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    // Pre-create repo mocks so we can share them between the module and the transaction EM
    const bracketRepo = mockRepo();
    const auditRepoInstance = mockAuditRepo();

    // Fake EntityManager that returns the same repos when getRepository(entity) is called
    const fakeEm = {
      getRepository: vi.fn((entity: any) => {
        if (entity === Bracket) return bracketRepo;
        if (entity === BracketAuditLog) return auditRepoInstance;
        return { save: vi.fn(), create: vi.fn(), update: vi.fn() };
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        BracketsService,
        { provide: getRepositoryToken(Bracket), useValue: bracketRepo },
        { provide: getRepositoryToken(BracketAuditLog), useValue: auditRepoInstance },
        { provide: getRepositoryToken(TournamentOperator), useFactory: mockOperatorsRepo },
        { provide: TournamentsService, useFactory: mockTournamentsService },
        { provide: EntriesService, useFactory: mockEntriesService },
        { provide: EventsGateway, useValue: { emitBracketUpdate: vi.fn() } },
        {
          provide: MatchAssignmentsService,
          useValue: { finishForMatch: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: TelegramNotificationsService,
          useValue: {
            notifyOpponentWithdrew: vi.fn().mockResolvedValue(undefined),
            notifyMatchReminder: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WeighInsService,
          useValue: {
            findMissingForEntries: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            getRepository: vi.fn(),
            transaction: vi.fn(async (cb: any) => cb(fakeEm)),
          },
        },
      ],
    }).compile();

    service = module.get(BracketsService);
    repo = module.get(getRepositoryToken(Bracket));
    auditRepo = module.get(getRepositoryToken(BracketAuditLog));
    operatorsRepo = module.get(getRepositoryToken(TournamentOperator));
    tournamentsService = module.get(TournamentsService);
    entriesService = module.get(EntriesService);
    eventsGateway = module.get(EventsGateway);
    weighInsService = module.get(WeighInsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate bracket with confirmed entries', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2'), makeEntry('u3'), makeEntry('u4')],
      });
      const created = makeBracket();
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.generate({ tournamentId: 'tournament-1' }, 'org-1');
      expect(result.status).toBe('active');
    });

    it('should include checked-in entries in the candidate pool (regression)', async () => {
      // Regression: previously the query filtered by status='confirmed' only,
      // so once an organizer ran admin check-in (status: confirmed → checked_in)
      // those entries dropped out and generation failed with "At least 2…".
      tournamentsService.findById.mockResolvedValue(makeTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2'), makeEntry('u3'), makeEntry('u4')],
      });
      const created = makeBracket();
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await service.generate({ tournamentId: 'tournament-1' }, 'org-1');

      expect(entriesService.findByTournament).toHaveBeenCalledWith(
        'tournament-1',
        expect.objectContaining({ status: ['confirmed', 'checked_in'] }),
      );
    });

    it('should throw if not organizer', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament());
      await expect(service.generate({ tournamentId: 't1' }, 'wrong')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if fewer than 2 entries', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament());
      entriesService.findByTournament.mockResolvedValue({ data: [makeEntry('u1')] });
      await expect(service.generate({ tournamentId: 't1' }, 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Phase 3.1: weigh-in gate ──────────────────────────────
  describe('weigh-in gate', () => {
    const makeArmwrestlingTournament = () =>
      makeTournament({
        sport: { slug: 'armwrestling', config: {} },
      });

    it('generate: blocks when any confirmed entry is unweighed (armwrestling)', async () => {
      tournamentsService.findById.mockResolvedValue(makeArmwrestlingTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2'), makeEntry('u3')],
      });
      weighInsService.findMissingForEntries.mockResolvedValue(['entry-u2']);

      await expect(
        service.generate({ tournamentId: 't1' }, 'org-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'WEIGH_IN_REQUIRED',
          unweighedEntryIds: ['entry-u2'],
        }),
      });
    });

    it('generate: allows when all confirmed entries are weighed', async () => {
      tournamentsService.findById.mockResolvedValue(makeArmwrestlingTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      weighInsService.findMissingForEntries.mockResolvedValue([]);
      const created = makeBracket();
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await expect(service.generate({ tournamentId: 't1' }, 'org-1')).resolves.toBeDefined();
      expect(weighInsService.findMissingForEntries).toHaveBeenCalledWith([
        'entry-u1',
        'entry-u2',
      ]);
    });

    it('generate: skips the gate entirely when sport does not require weigh-in (chess)', async () => {
      // Chess preset's `defaultBracketFormat` is `swiss` (Phase 3.3a slice 2
      // ships only single_elim + double_elim); override to a supported
      // default so the format dispatch doesn't 400 before the gate check.
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'chess', config: { defaultBracketFormat: 'single_elim' } },
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      const created = makeBracket();
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await expect(service.generate({ tournamentId: 't1' }, 'org-1')).resolves.toBeDefined();
      // Gate short-circuits before calling the weigh-ins service.
      expect(weighInsService.findMissingForEntries).not.toHaveBeenCalled();
    });

    it('generate: sport-wide config (weighInRequired=false) disables the gate', async () => {
      // Sport-wide config: every event of this sport skips weigh-in.
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'armwrestling', config: { weighInRequired: false } },
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      const created = makeBracket();
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await expect(service.generate({ tournamentId: 't1' }, 'org-1')).resolves.toBeDefined();
      expect(weighInsService.findMissingForEntries).not.toHaveBeenCalled();
    });

    it('generate: per-tournament sportConfig override (weighInRequired=false) disables the gate', async () => {
      // Per-event override: armwrestling sport-wide STILL requires weigh-in,
      // but THIS tournament opts out via `tournament.sportConfig`. Mirrors
      // the precedence used by `startCategory` for `requireCheckIn`.
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'armwrestling', config: {} }, // sport-wide: weighInRequired=true
          sportConfig: { weighInRequired: false }, // event-level override
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      const created = makeBracket();
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      await expect(service.generate({ tournamentId: 't1' }, 'org-1')).resolves.toBeDefined();
      expect(weighInsService.findMissingForEntries).not.toHaveBeenCalled();
    });

    it('generate: per-tournament sportConfig override (weighInRequired=true) enables the gate for chess', async () => {
      // Reverse direction: chess sport-wide doesn't require weigh-in, but
      // a particular event opts IN via `tournament.sportConfig`.
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'chess', config: {} }, // sport-wide: weighInRequired=false
          sportConfig: { weighInRequired: true }, // event-level override
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2'), makeEntry('u3')],
      });
      weighInsService.findMissingForEntries.mockResolvedValue(['entry-u2']);

      await expect(
        service.generate({ tournamentId: 't1' }, 'org-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'WEIGH_IN_REQUIRED' }),
      });
    });

    it('generateForGroup: blocks on unweighed entries', async () => {
      tournamentsService.findById.mockResolvedValue(makeArmwrestlingTournament());
      entriesService.findByGroup.mockResolvedValue([
        makeEntry('u1'),
        makeEntry('u2'),
      ]);
      weighInsService.findMissingForEntries.mockResolvedValue(['entry-u1']);

      await expect(
        service.generateForGroup(
          { tournamentId: 't1', ageGroup: 'adults', hand: 'right' },
          'org-1',
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'WEIGH_IN_REQUIRED' }),
      });
    });
  });

  // ─── Phase 3.3a: format dispatch ───────────────────────────
  describe('format dispatch', () => {
    const armwrestlingTournament = () =>
      makeTournament({
        sport: { slug: 'armwrestling', config: {} },
      });
    const chessTournament = () =>
      makeTournament({
        sport: { slug: 'chess', config: {} },
      });

    it('uses double_elim from sport defaults (armwrestling)', async () => {
      const { generateDoubleElimination, generateSingleElimination } = await import(
        '@gsm/bracket-engine'
      );
      tournamentsService.findById.mockResolvedValue(armwrestlingTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await service.generate({ tournamentId: 't1' }, 'org-1');

      expect(generateDoubleElimination).toHaveBeenCalled();
      expect(generateSingleElimination).not.toHaveBeenCalled();
    });

    it('uses swiss from chess sport defaults (default generator now implemented)', async () => {
      const { generateSwiss, generateDoubleElimination } = await import(
        '@gsm/bracket-engine'
      );
      // chess preset's defaultBracketFormat is 'swiss' — implemented since
      // phase 3.3c slice 2. The natural fallback (no DTO override) lands
      // on the swiss generator.
      tournamentsService.findById.mockResolvedValue(chessTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await service.generate({ tournamentId: 't1' }, 'org-1');

      expect(generateSwiss).toHaveBeenCalled();
      expect(generateDoubleElimination).not.toHaveBeenCalled();
    });

    it('honors per-tournament sportConfig override (defaultBracketFormat)', async () => {
      // Per-event override: armwrestling's sport-wide default is
      // `double_elim`, but THIS tournament opts to use `single_elim` via
      // `tournament.sportConfig.defaultBracketFormat`. Mirrors the
      // precedence used by weigh-in and match-result resolution.
      const { generateSingleElimination, generateDoubleElimination } = await import(
        '@gsm/bracket-engine'
      );
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'armwrestling', config: {} },
          sportConfig: { defaultBracketFormat: 'single_elim' },
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await service.generate({ tournamentId: 't1' }, 'org-1');

      expect(generateSingleElimination).toHaveBeenCalled();
      expect(generateDoubleElimination).not.toHaveBeenCalled();
    });

    it('honors an explicit bracketFormat from the DTO when allowed', async () => {
      const { generateSingleElimination } = await import('@gsm/bracket-engine');
      tournamentsService.findById.mockResolvedValue(armwrestlingTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await service.generate(
        { tournamentId: 't1', bracketFormat: 'single_elim' },
        'org-1',
      );

      expect(generateSingleElimination).toHaveBeenCalled();
    });

    it('rejects a DTO format not in the sport allow-list', async () => {
      // chess preset only allows swiss / round_robin / single_elim — asking
      // for double_elim here is a 400.
      tournamentsService.findById.mockResolvedValue(chessTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });

      await expect(
        service.generate({ tournamentId: 't1', bracketFormat: 'double_elim' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('dispatches to generateGroupsPlayoff when format is groups_playoff', async () => {
      // groups_playoff isn't in any preset's `bracketFormats` allow-list
      // out of the box; override chess to include it.
      const { generateGroupsPlayoff, generateDoubleElimination } = await import(
        '@gsm/bracket-engine'
      );
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: {
            slug: 'chess',
            config: {
              bracketFormats: ['swiss', 'round_robin', 'single_elim', 'groups_playoff'],
              defaultBracketFormat: 'swiss',
            },
          },
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2'), makeEntry('u3'), makeEntry('u4')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await service.generate(
        { tournamentId: 't1', bracketFormat: 'groups_playoff' },
        'org-1',
      );

      expect(generateGroupsPlayoff).toHaveBeenCalled();
      expect(generateDoubleElimination).not.toHaveBeenCalled();
    });

    it('dispatches to generateSwiss when format is swiss', async () => {
      const { generateSwiss, generateRoundRobin, generateDoubleElimination } =
        await import('@gsm/bracket-engine');
      tournamentsService.findById.mockResolvedValue(chessTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2'), makeEntry('u3'), makeEntry('u4')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await service.generate(
        { tournamentId: 't1', bracketFormat: 'swiss' },
        'org-1',
      );

      expect(generateSwiss).toHaveBeenCalled();
      expect(generateRoundRobin).not.toHaveBeenCalled();
      expect(generateDoubleElimination).not.toHaveBeenCalled();
    });

    it('dispatches to generateRoundRobin when format is round_robin', async () => {
      const { generateRoundRobin, generateDoubleElimination, generateSingleElimination } =
        await import('@gsm/bracket-engine');
      tournamentsService.findById.mockResolvedValue(chessTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2'), makeEntry('u3')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await service.generate(
        { tournamentId: 't1', bracketFormat: 'round_robin' },
        'org-1',
      );

      expect(generateRoundRobin).toHaveBeenCalled();
      expect(generateDoubleElimination).not.toHaveBeenCalled();
      expect(generateSingleElimination).not.toHaveBeenCalled();
    });

    it('generateForGroup honors the requested format', async () => {
      const { generateSingleElimination } = await import('@gsm/bracket-engine');
      tournamentsService.findById.mockResolvedValue(armwrestlingTournament());
      entriesService.findByGroup.mockResolvedValue([makeEntry('u1'), makeEntry('u2')]);
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await service.generateForGroup(
        {
          tournamentId: 't1',
          ageGroup: 'adults',
          hand: 'right',
          bracketFormat: 'single_elim',
        },
        'org-1',
      );

      expect(generateSingleElimination).toHaveBeenCalled();
    });

    it('happy path: pairs[] resolved to Player objects and forwarded to generateArmfight', async () => {
      // sub-project B: armfight is now an admin-curated fight card. The
      // wizard posts pairs[] (entry-id A vs entry-id B, with hand). The
      // service resolves each id to a Player and passes the list to
      // `generateArmfight`. No N=2-only restriction — the engine accepts
      // any number of pairs >= 1.
      const { generateArmfight, generateDoubleElimination } = await import(
        '@gsm/bracket-engine'
      );
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'armwrestling', config: {} },
          sportConfig: { competitionType: 'armfight' },
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2'), makeEntry('u3'), makeEntry('u4')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await service.generate(
        {
          tournamentId: 't1',
          pairs: [
            { playerAId: 'entry-u1', playerBId: 'entry-u2', hand: 'right' },
            { playerAId: 'entry-u3', playerBId: 'entry-u4', hand: 'left' },
          ],
        } as any,
        'org-1',
      );

      expect(generateArmfight).toHaveBeenCalledTimes(1);
      const callArg = (generateArmfight as any).mock.calls[0][0];
      expect(callArg).toHaveLength(2);
      expect(callArg[0].hand).toBe('right');
      expect(callArg[0].playerA.id).toBe('entry-u1');
      expect(callArg[0].playerB.id).toBe('entry-u2');
      expect(callArg[1].hand).toBe('left');
      expect(callArg[1].playerA.id).toBe('entry-u3');
      expect(callArg[1].playerB.id).toBe('entry-u4');
      expect(generateDoubleElimination).not.toHaveBeenCalled();
    });

    it('rejects when pairs[] is missing for armfight', async () => {
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'armwrestling', config: {} },
          sportConfig: { competitionType: 'armfight' },
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await expect(
        service.generate({ tournamentId: 't1' }, 'org-1'),
      ).rejects.toThrow(/pairs/i);
    });

    it('rejects when a pair references a player not in entries', async () => {
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'armwrestling', config: {} },
          sportConfig: { competitionType: 'armfight' },
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await expect(
        service.generate(
          {
            tournamentId: 't1',
            pairs: [{ playerAId: 'entry-u1', playerBId: 'GHOST', hand: 'right' }],
          } as any,
          'org-1',
        ),
      ).rejects.toThrow(/not a confirmed entry|references player|playerBId/i);
    });

    it('honors an explicit bracketFormat=armfight from the DTO (armwrestling allows it)', async () => {
      // The DTO can request `armfight` explicitly even without
      // `competitionType: 'armfight'` on the tournament — as long as the
      // sport's allow-list permits it. Supply pairs[] so the new
      // pairs-required check passes and the engine actually runs.
      const { generateArmfight } = await import('@gsm/bracket-engine');
      tournamentsService.findById.mockResolvedValue(armwrestlingTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await service.generate(
        {
          tournamentId: 't1',
          bracketFormat: 'armfight',
          pairs: [{ playerAId: 'entry-u1', playerBId: 'entry-u2', hand: 'right' }],
        } as any,
        'org-1',
      );

      expect(generateArmfight).toHaveBeenCalled();
    });

    it('rejects competitionType=armfight on a sport that does not allow armfight (boxing)', async () => {
      // Boxing's SportPreset doesn't list `armfight` — flipping
      // `competitionType: 'armfight'` on a boxing tournament must NOT
      // silently dispatch to `generateArmfight`. The allow-list check
      // applies to the auto-resolved format and runs in `resolveFormat`,
      // before pairs[] validation — so the surface error is still
      // "not allowed for this sport" even when pairs are absent.
      const { generateArmfight } = await import('@gsm/bracket-engine');
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'boxing', config: {} },
          sportConfig: { competitionType: 'armfight' },
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await expect(service.generate({ tournamentId: 't1' }, 'org-1')).rejects.toThrow(
        /not allowed for this sport/i,
      );
      expect(generateArmfight).not.toHaveBeenCalled();
    });

    it('generateForGroup throws for armfight (must use pairs[] path)', async () => {
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'armwrestling', config: {} },
          sportConfig: { competitionType: 'armfight' },
        }),
      );
      entriesService.findByGroup.mockResolvedValue([makeEntry('u1'), makeEntry('u2')]);
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());
      await expect(
        service.generateForGroup(
          {
            tournamentId: 't1',
            ageGroup: 'open',
            hand: 'right',
            bracketFormat: 'armfight',
          },
          'org-1',
        ),
      ).rejects.toThrow(/pairs|armfight/i);
    });

    it('rejects per-tournament defaultBracketFormat that the sport does not allow', async () => {
      // Mirror of the bug above for the `defaultBracketFormat` route:
      // a chess tournament can't override into `double_elim` if the
      // chess preset only allows swiss / round_robin / single_elim.
      const { generateDoubleElimination } = await import('@gsm/bracket-engine');
      tournamentsService.findById.mockResolvedValue(
        makeTournament({
          sport: { slug: 'chess', config: {} },
          sportConfig: { defaultBracketFormat: 'double_elim' },
        }),
      );
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2')],
      });
      repo.create.mockReturnValue(makeBracket());
      repo.save.mockResolvedValue(makeBracket());

      await expect(service.generate({ tournamentId: 't1' }, 'org-1')).rejects.toThrow(
        /not allowed for this sport/i,
      );
      expect(generateDoubleElimination).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return bracket', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      const result = await service.findById('bracket-1');
      expect(result.id).toBe('bracket-1');
    });

    it('should throw if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('loads the tournament.sport relation (regression — startCategory relies on it)', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await service.findById('bracket-1');

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bracket-1' },
          relations: expect.arrayContaining(['tournament.sport']),
        }),
      );
    });
  });

  describe('recordResult', () => {
    it('should call selectWinner and update bracket when organizer', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.findOne.mockResolvedValueOnce(makeBracket());
      const { findMatch } = await import('@gsm/bracket-engine');
      vi.mocked(findMatch).mockReturnValueOnce({
        id: 'm1',
        winner: null,
        player1: { id: 'p1' },
        player2: { id: 'p2' },
      } as any);

      await service.recordResult('bracket-1', { matchId: 'm1', winnerId: 'p1' }, 'org-1', []);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(eventsGateway.emitBracketUpdate).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not organizer/admin/operator', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      operatorsRepo.count.mockResolvedValue(0);
      await expect(
        service.recordResult('b1', { matchId: 'm1', winnerId: 'p1' }, 'wrong', []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow assigned operator to record result', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.findOne.mockResolvedValueOnce(makeBracket());
      operatorsRepo.count.mockResolvedValue(1);

      await service.recordResult('bracket-1', { matchId: 'm1', winnerId: 'p1' }, 'operator-1', []);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should throw if bracket is locked and user is not admin', async () => {
      repo.findOne.mockResolvedValue(makeBracket({ isLocked: true }));
      await expect(
        service.recordResult('b1', { matchId: 'm1', winnerId: 'p1' }, 'org-1', []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to change result when bracket is locked', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket({ isLocked: true }));
      repo.findOne.mockResolvedValueOnce(makeBracket({ isLocked: true }));

      await service.recordResult('bracket-1', { matchId: 'm1', winnerId: 'p1' }, 'admin-1', [
        'admin',
      ]);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should fail validation when canRecordResult reports invalid', async () => {
      const { canRecordResult } = await import('@gsm/bracket-engine');
      vi.mocked(canRecordResult).mockReturnValueOnce({
        valid: false,
        errors: ['TBD'],
      });
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(
        service.recordResult('b1', { matchId: 'm1', winnerId: 'p1' }, 'org-1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail validation when validateResult reports invalid', async () => {
      const { canRecordResult, validateResult } = await import('@gsm/bracket-engine');
      vi.mocked(canRecordResult).mockReturnValueOnce({ valid: true, errors: [] });
      vi.mocked(validateResult).mockReturnValueOnce({
        valid: false,
        errors: ['bad winner'],
      });
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(
        service.recordResult('b1', { matchId: 'm1', winnerId: 'stranger' }, 'org-1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require forceCorrect when overwriting an existing result', async () => {
      const { findMatch } = await import('@gsm/bracket-engine');
      vi.mocked(findMatch).mockReturnValueOnce({
        id: 'm1',
        winner: 'p1',
        player1: { id: 'p1' },
        player2: { id: 'p2' },
      } as any);
      repo.findOne.mockResolvedValue(makeBracket());

      await expect(
        service.recordResult('b1', { matchId: 'm1', winnerId: 'p2' }, 'org-1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should write audit log entry when recording a new result', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await service.recordResult('bracket-1', { matchId: 'm1', winnerId: 'p1' }, 'org-1', []);
      expect(auditRepo.save).toHaveBeenCalled();
    });

    // ─── Phase 3.2: sport-specific result detail ─────────────
    describe('result detail validation', () => {
      function makeArmfightBracketData() {
        return {
          format: 'armfight' as const,
          players: [
            { id: 'p1', firstName: 'A', lastName: '1', number: '1' },
            { id: 'p2', firstName: 'B', lastName: '2', number: '2' },
          ],
          bracketSize: 2,
          wbRounds: 1,
          winnersBracket: [[{
            id: 'wb_1_0', round: 1, matchIndex: 0,
            player1: { id: 'p1', firstName: 'A', lastName: '1', number: '1' },
            player2: { id: 'p2', firstName: 'B', lastName: '2', number: '2' },
            winner: null, loser: null,
            result: { hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'pending' },
          }]],
          losersBracket: [],
          grandFinal: {
            id: 'gf',
            player1: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' },
            player2: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' },
            winner: null, loser: null,
          },
          superFinal: {
            id: 'sf',
            player1: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' },
            player2: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' },
            winner: null, loser: null, needed: false,
          },
          champion: null,
          status: 'active' as const,
        };
      }

      const armwrestlingBracket = () =>
        makeBracket({
          tournament: {
            id: 'tournament-1',
            organizerId: 'org-1',
            sport: { slug: 'armwrestling', config: {} },
          },
        });

      it('rejects a result payload whose schema mismatches the sport', async () => {
        const { findMatch } = await import('@gsm/bracket-engine');
        vi.mocked(findMatch).mockReturnValueOnce({
          id: 'm1',
          winner: null,
          player1: { id: 'p1' },
          player2: { id: 'p2' },
        } as any);
        repo.findOne.mockResolvedValue(armwrestlingBracket());

        await expect(
          service.recordResult(
            'bracket-1',
            {
              matchId: 'm1',
              winnerId: 'p1',
              result: { schema: 'points', cards: [] },
            },
            'org-1',
            [],
          ),
        ).rejects.toMatchObject({
          response: expect.objectContaining({ code: 'INVALID_MATCH_RESULT' }),
        });
      });

      it('rejects a structurally-invalid armwrestling payload', async () => {
        const { findMatch } = await import('@gsm/bracket-engine');
        vi.mocked(findMatch).mockReturnValueOnce({
          id: 'm1',
          winner: null,
          player1: { id: 'p1' },
          player2: { id: 'p2' },
        } as any);
        repo.findOne.mockResolvedValue(armwrestlingBracket());

        await expect(
          service.recordResult(
            'bracket-1',
            {
              matchId: 'm1',
              winnerId: 'p1',
              result: { schema: 'armwrestling', victoryType: 'tko' },
            },
            'org-1',
            [],
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('accepts a valid armwrestling payload and threads it into selectWinner', async () => {
        const { findMatch, selectWinner } = await import('@gsm/bracket-engine');
        vi.mocked(findMatch).mockReturnValue({
          id: 'm1',
          winner: null,
          player1: { id: 'p1' },
          player2: { id: 'p2' },
        } as any);
        repo.findOne.mockResolvedValue(armwrestlingBracket());

        const payload = {
          schema: 'armwrestling' as const,
          victoryType: 'pin' as const,
          fouls: { p1: 0, p2: 1 },
        };

        await service.recordResult(
          'bracket-1',
          { matchId: 'm1', winnerId: 'p1', result: payload },
          'org-1',
          [],
        );

        expect(selectWinner).toHaveBeenCalledWith(
          expect.anything(),
          'm1',
          'p1',
          'org-1',
          payload,
        );
      });

      it('omitting result leaves selectWinner receiving undefined (preserve semantics)', async () => {
        const { findMatch, selectWinner } = await import('@gsm/bracket-engine');
        vi.mocked(findMatch).mockReturnValue({
          id: 'm1',
          winner: null,
          player1: { id: 'p1' },
          player2: { id: 'p2' },
        } as any);
        repo.findOne.mockResolvedValue(armwrestlingBracket());

        await service.recordResult(
          'bracket-1',
          { matchId: 'm1', winnerId: 'p1' },
          'org-1',
          [],
        );

        expect(selectWinner).toHaveBeenCalledWith(
          expect.anything(),
          'm1',
          'p1',
          'org-1',
          undefined,
        );
      });

      it('resolves matchResultSchema to "armfight_bo5" when bracketData.format === "armfight"', async () => {
        const { findMatch } = await import('@gsm/bracket-engine');
        vi.mocked(findMatch).mockReturnValueOnce({
          id: 'wb_1_0',
          winner: null,
          player1: { id: 'p1' },
          player2: { id: 'p2' },
        } as any);
        const tournament = makeTournament({
          sport: { slug: 'armwrestling', config: {} },
          sportConfig: { competitionType: 'armfight' },
        });
        const bracket = makeBracket({
          tournament,
          bracketData: makeArmfightBracketData() as any,
        });
        repo.findOne.mockResolvedValue(bracket);
        await expect(
          service.recordResult(
            bracket.id,
            { matchId: 'wb_1_0', winnerId: 'p1', result: { schema: 'armwrestling' } } as any,
            tournament.organizerId,
            ['organizer'],
          ),
        ).rejects.toThrow(/armfight_bo5/);
      });

      it('explicit null is forwarded so the engine clears the prior payload', async () => {
        const { findMatch, selectWinner } = await import('@gsm/bracket-engine');
        vi.mocked(findMatch).mockReturnValue({
          id: 'm1',
          winner: null,
          player1: { id: 'p1' },
          player2: { id: 'p2' },
        } as any);
        repo.findOne.mockResolvedValue(armwrestlingBracket());

        await service.recordResult(
          'bracket-1',
          { matchId: 'm1', winnerId: 'p1', result: null },
          'org-1',
          [],
        );

        expect(selectWinner).toHaveBeenCalledWith(
          expect.anything(),
          'm1',
          'p1',
          'org-1',
          null,
        );
      });
    });
  });

  describe('resetSingleMatch', () => {
    it('should clear a single match and write audit log', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.findOne.mockResolvedValueOnce(makeBracket());

      await service.resetSingleMatch(
        'bracket-1',
        { matchId: 'm1', reason: 'wrong call' },
        'org-1',
        [],
      );

      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(auditRepo.save).toHaveBeenCalled();
      expect(eventsGateway.emitBracketUpdate).toHaveBeenCalled();
    });

    it('should throw if bracket has no data', async () => {
      repo.findOne.mockResolvedValue(makeBracket({ bracketData: null }));
      await expect(service.resetSingleMatch('b1', { matchId: 'm1' }, 'org-1', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException for non-organizer / non-admin', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(
        service.resetSingleMatch('b1', { matchId: 'm1' }, 'stranger', []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not allow a plain operator to reset a match', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      operatorsRepo.count.mockResolvedValue(1);
      await expect(
        service.resetSingleMatch('b1', { matchId: 'm1' }, 'operator-1', []),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setLocked', () => {
    it('should lock a bracket when called by organizer', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.findOne.mockResolvedValueOnce(makeBracket({ isLocked: true }));

      await service.setLocked('bracket-1', true, 'org-1', []);
      expect(repo.update).toHaveBeenCalledWith(
        'bracket-1',
        expect.objectContaining({ isLocked: true }),
      );
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('should unlock a bracket when called by admin', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket({ isLocked: true }));
      repo.findOne.mockResolvedValueOnce(makeBracket({ isLocked: false }));

      await service.setLocked('bracket-1', false, 'admin-1', ['admin']);
      expect(repo.update).toHaveBeenCalledWith(
        'bracket-1',
        expect.objectContaining({ isLocked: false }),
      );
    });

    it('should throw for non-authorized user', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(service.setLocked('b1', true, 'stranger', [])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('reset', () => {
    it('should reset bracket to pending and write audit log', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.findOne.mockResolvedValueOnce(makeBracket({ status: 'pending', bracketData: null }));

      await service.reset('bracket-1', 'org-1', []);

      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException on concurrent modification', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.createQueryBuilder.mockReturnValueOnce(makeUpdateQB(0));

      await expect(service.reset('bracket-1', 'org-1', [])).rejects.toThrow(BadRequestException);
    });

    it('should throw if not organizer/admin', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(service.reset('b1', 'wrong', [])).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAuditLog', () => {
    it('should return the last 100 audit entries when user has access', async () => {
      const logs = [{ id: 'log-1', action: 'result_recorded' }];
      repo.findOne.mockResolvedValue(makeBracket());
      auditRepo.find.mockResolvedValue(logs);

      const result = await service.getAuditLog('bracket-1', 'org-1', []);
      expect(auditRepo.find).toHaveBeenCalledWith({
        where: { bracketId: 'bracket-1' },
        order: { createdAt: 'DESC' },
        take: 100,
      });
      expect(result).toEqual(logs);
    });

    it('should allow assigned operator to read the log', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      operatorsRepo.count.mockResolvedValue(1);
      auditRepo.find.mockResolvedValue([]);

      await service.getAuditLog('bracket-1', 'operator-1', []);
      expect(auditRepo.find).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-organizer / non-admin / non-operator', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      operatorsRepo.count.mockResolvedValue(0);

      await expect(service.getAuditLog('bracket-1', 'stranger', [])).rejects.toThrow(
        ForbiddenException,
      );
      expect(auditRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('getPendingMatches', () => {
    it('should return matches where both players are real and no winner recorded', () => {
      const bd: any = {
        winnersBracket: [
          [
            {
              id: 'wb_1_0',
              winner: null,
              player1: { id: 'p1' },
              player2: { id: 'p2' },
            },
            {
              id: 'wb_1_1',
              winner: 'p3',
              player1: { id: 'p3' },
              player2: { id: 'p4' },
            },
            {
              id: 'wb_1_2',
              winner: null,
              player1: { id: 'tbd' },
              player2: { id: 'p5' },
            },
          ],
        ],
        losersBracket: [],
        grandFinal: {
          id: 'grand_final',
          winner: null,
          player1: { id: 'tbd' },
          player2: { id: 'tbd' },
        },
        superFinal: { needed: false, winner: null, player1: { id: 'tbd' }, player2: { id: 'tbd' } },
      };

      const pending = service.getPendingMatches(bd);
      expect(pending).toHaveLength(1);
      expect(pending[0].matchId).toBe('wb_1_0');
      expect(pending[0].section).toBe('winners');
    });

    it('should include grand final when both players are known', () => {
      const bd: any = {
        winnersBracket: [],
        losersBracket: [],
        grandFinal: {
          id: 'grand_final',
          winner: null,
          player1: { id: 'p1' },
          player2: { id: 'p2' },
        },
        superFinal: { needed: false, winner: null, player1: { id: 'tbd' }, player2: { id: 'tbd' } },
      };

      const pending = service.getPendingMatches(bd);
      expect(pending.some((p) => p.section === 'grand_final')).toBe(true);
    });
  });

  describe('replacePlayer', () => {
    const makeConfirmedEntry = (overrides: any = {}) => ({
      id: 'entry-replacement',
      tournamentId: 'tournament-1',
      status: 'confirmed',
      weightCategoryId: 'wc-1',
      ageGroup: 'adults',
      hand: 'right',
      weightKg: 75,
      seedNumber: 5,
      user: { firstName: 'Sub', lastName: 'Player', avatarUrl: null },
      ...overrides,
    });

    const makeCurrentEntry = (overrides: any = {}) => ({
      id: 'p1',
      tournamentId: 'tournament-1',
      weightCategoryId: 'wc-1',
      ageGroup: 'adults',
      hand: 'right',
      ...overrides,
    });

    it('replaces the slot when admin/organizer, writes audit and emits socket update', async () => {
      repo.findOne.mockResolvedValue(makeBracket({ modificationCount: 0 }));
      entriesService.findById = vi
        .fn()
        .mockResolvedValueOnce(makeConfirmedEntry()) // lookup for new entry
        .mockResolvedValueOnce(makeCurrentEntry()); // lookup for slot's current entry

      const result = await service.replacePlayer(
        'bracket-1',
        'wb_1_0',
        { position: 1, newEntryId: 'entry-replacement', reason: 'athlete injured' },
        'org-1',
        [],
      );

      expect(result).toBeDefined();
      expect(auditRepo.save).toHaveBeenCalled();
      expect(eventsGateway.emitBracketUpdate).toHaveBeenCalled();
    });

    it('rejects a replacement entry from a different tournament', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      entriesService.findById = vi
        .fn()
        .mockResolvedValueOnce(makeConfirmedEntry({ tournamentId: 'different-tournament' }));

      await expect(
        service.replacePlayer(
          'bracket-1',
          'wb_1_0',
          { position: 1, newEntryId: 'entry-x', reason: 'swap' },
          'org-1',
          [],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a replacement entry that is not confirmed', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      entriesService.findById = vi
        .fn()
        .mockResolvedValueOnce(makeConfirmedEntry({ status: 'pending' }));

      await expect(
        service.replacePlayer(
          'bracket-1',
          'wb_1_0',
          { position: 1, newEntryId: 'entry-x', reason: 'swap' },
          'org-1',
          [],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects cross-category replacements (different weight/age/hand)', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      entriesService.findById = vi
        .fn()
        .mockResolvedValueOnce(makeConfirmedEntry({ weightCategoryId: 'wc-DIFFERENT' }))
        .mockResolvedValueOnce(makeCurrentEntry());

      await expect(
        service.replacePlayer(
          'bracket-1',
          'wb_1_0',
          { position: 1, newEntryId: 'entry-x', reason: 'swap' },
          'org-1',
          [],
        ),
      ).rejects.toThrow(/weight category/);
    });

    it('rejects non-admin non-organizer callers (operator not allowed for replace)', async () => {
      repo.findOne.mockResolvedValue(makeBracket());

      await expect(
        service.replacePlayer(
          'bracket-1',
          'wb_1_0',
          { position: 1, newEntryId: 'entry-x', reason: 'swap' },
          'some-operator',
          [],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when the bracket is locked', async () => {
      repo.findOne.mockResolvedValue(makeBracket({ isLocked: true }));

      await expect(
        service.replacePlayer(
          'bracket-1',
          'wb_1_0',
          { position: 1, newEntryId: 'entry-x', reason: 'swap' },
          'org-1',
          [],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('surfaces engine errors as BadRequest', async () => {
      const engine = await import('@gsm/bracket-engine');
      (engine.replacePlayerInSlot as any).mockReturnValueOnce({
        ok: false,
        error: 'Player has already won a prior match',
      });
      repo.findOne.mockResolvedValue(makeBracket());
      entriesService.findById = vi
        .fn()
        .mockResolvedValueOnce(makeConfirmedEntry())
        .mockResolvedValueOnce(makeCurrentEntry());

      await expect(
        service.replacePlayer(
          'bracket-1',
          'wb_1_0',
          { position: 1, newEntryId: 'entry-x', reason: 'swap' },
          'org-1',
          [],
        ),
      ).rejects.toThrow(/prior match/);
    });
  });

  describe('withdrawPlayer', () => {
    it('allows assigned operator to withdraw and forfeits to opponent', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      operatorsRepo.count.mockResolvedValue(1); // caller is assigned operator

      const result = await service.withdrawPlayer(
        'bracket-1',
        'wb_1_0',
        { position: 1, reason: 'no-show' },
        'operator-user',
        [],
      );

      expect(result).toBeDefined();
      expect(auditRepo.save).toHaveBeenCalled();
      expect(eventsGateway.emitBracketUpdate).toHaveBeenCalled();
    });

    it('rejects non-admin when the bracket is locked', async () => {
      repo.findOne.mockResolvedValue(makeBracket({ isLocked: true }));

      await expect(
        service.withdrawPlayer(
          'bracket-1',
          'wb_1_0',
          { position: 1, reason: 'no-show' },
          'org-1',
          [],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to override lock', async () => {
      repo.findOne.mockResolvedValue(makeBracket({ isLocked: true }));

      const result = await service.withdrawPlayer(
        'bracket-1',
        'wb_1_0',
        { position: 1, reason: 'injury' },
        'admin-user',
        ['admin'],
      );

      expect(result).toBeDefined();
    });

    it('surfaces engine errors (e.g. opponent is BYE) as BadRequest', async () => {
      const engine = await import('@gsm/bracket-engine');
      (engine.withdrawPlayerFromSlot as any).mockReturnValueOnce({
        ok: false,
        error: 'Opponent is not a real player',
      });
      repo.findOne.mockResolvedValue(makeBracket());

      await expect(
        service.withdrawPlayer(
          'bracket-1',
          'wb_1_0',
          { position: 1, reason: 'no-show' },
          'org-1',
          [],
        ),
      ).rejects.toThrow(/real player/);
    });
  });

  describe('startCategory', () => {
    const withFirstRound = (matches: Array<{ id: string; p1: string; p2: string }>) =>
      makeBracket({
        tournament: makeTournament({
          sportConfig: null,
          sport: {
            slug: 'armwrestling',
            config: {
              // resolveSportConfig fills in defaults including
              // requireCheckIn: true for armwrestling.
            },
          },
        }),
        bracketData: {
          players: [],
          bracketSize: matches.length * 2,
          wbRounds: 1,
          winnersBracket: [
            matches.map((m) => ({
              id: m.id,
              winner: null,
              player1: { id: m.p1 },
              player2: { id: m.p2 },
            })),
          ],
          losersBracket: [],
          grandFinal: { id: 'gf' },
          superFinal: { id: 'sf', needed: false },
        },
      });

    it('no-ops when requireCheckIn is false (e.g. chess tournament)', async () => {
      const chessBracket = makeBracket({
        tournament: makeTournament({
          sport: { slug: 'chess', config: {} },
        }),
        bracketData: {
          players: [],
          bracketSize: 2,
          wbRounds: 1,
          winnersBracket: [
            [{ id: 'm1', winner: null, player1: { id: 'a' }, player2: { id: 'b' } }],
          ],
          losersBracket: [],
          grandFinal: { id: 'gf' },
          superFinal: { id: 'sf', needed: false },
        },
      });
      repo.findOne.mockResolvedValue(chessBracket);

      const result = await service.startCategory('bracket-1', 'org-1', []);

      expect(result.requireCheckIn).toBe(false);
      expect(result.withdrawn).toEqual([]);
      expect(entriesService.findByIds).not.toHaveBeenCalled();
    });

    it('forfeits the uncheck-in player and skips the other', async () => {
      const bracket = withFirstRound([{ id: 'm1', p1: 'ent-a', p2: 'ent-b' }]);
      repo.findOne.mockResolvedValue(bracket);
      entriesService.findByIds.mockResolvedValue([
        { id: 'ent-a', status: 'confirmed' }, // no-show
        { id: 'ent-b', status: 'checked_in' }, // present
      ]);
      // Spy on withdrawPlayer so we don't re-run its whole transaction path.
      const spy = vi
        .spyOn(service as any, 'withdrawPlayer')
        .mockResolvedValue(bracket as any);

      const result = await service.startCategory('bracket-1', 'org-1', []);

      expect(result.requireCheckIn).toBe(true);
      expect(result.withdrawn).toEqual(['ent-a']);
      expect(result.skipped).toEqual([]);
      expect(result.doubleNoShow).toEqual([]);
      expect(spy).toHaveBeenCalledWith(
        'bracket-1',
        'm1',
        expect.objectContaining({ position: 1, reason: expect.stringContaining('no-show') }),
        'org-1',
        [],
      );
    });

    it('forfeits player 2 when only player 2 is a no-show', async () => {
      const bracket = withFirstRound([{ id: 'm1', p1: 'ent-a', p2: 'ent-b' }]);
      repo.findOne.mockResolvedValue(bracket);
      entriesService.findByIds.mockResolvedValue([
        { id: 'ent-a', status: 'checked_in' },
        { id: 'ent-b', status: 'pending' }, // no-show
      ]);
      const spy = vi
        .spyOn(service as any, 'withdrawPlayer')
        .mockResolvedValue(bracket as any);

      const result = await service.startCategory('bracket-1', 'org-1', []);

      expect(result.withdrawn).toEqual(['ent-b']);
      expect(spy).toHaveBeenCalledWith(
        'bracket-1',
        'm1',
        expect.objectContaining({ position: 2 }),
        'org-1',
        [],
      );
    });

    it('records both-no-show matches to doubleNoShow without forfeiting', async () => {
      const bracket = withFirstRound([{ id: 'm1', p1: 'ent-a', p2: 'ent-b' }]);
      repo.findOne.mockResolvedValue(bracket);
      entriesService.findByIds.mockResolvedValue([
        { id: 'ent-a', status: 'confirmed' },
        { id: 'ent-b', status: 'pending' },
      ]);
      const spy = vi
        .spyOn(service as any, 'withdrawPlayer')
        .mockResolvedValue(bracket as any);

      const result = await service.startCategory('bracket-1', 'org-1', []);

      expect(result.withdrawn).toEqual([]);
      expect(result.doubleNoShow).toEqual(['m1']);
      expect(spy).not.toHaveBeenCalled();
    });

    it('skips already-withdrawn entries (no double-forfeit)', async () => {
      const bracket = withFirstRound([{ id: 'm1', p1: 'ent-a', p2: 'ent-b' }]);
      repo.findOne.mockResolvedValue(bracket);
      entriesService.findByIds.mockResolvedValue([
        { id: 'ent-a', status: 'withdrawn' },
        { id: 'ent-b', status: 'checked_in' },
      ]);
      const spy = vi
        .spyOn(service as any, 'withdrawPlayer')
        .mockResolvedValue(bracket as any);

      const result = await service.startCategory('bracket-1', 'org-1', []);

      expect(spy).not.toHaveBeenCalled();
      expect(result.withdrawn).toEqual([]);
    });

    it("does not forfeit 'rejected' entries (organizer already denied them)", async () => {
      const bracket = withFirstRound([{ id: 'm1', p1: 'ent-a', p2: 'ent-b' }]);
      repo.findOne.mockResolvedValue(bracket);
      entriesService.findByIds.mockResolvedValue([
        { id: 'ent-a', status: 'rejected' },
        { id: 'ent-b', status: 'checked_in' },
      ]);
      const spy = vi
        .spyOn(service as any, 'withdrawPlayer')
        .mockResolvedValue(bracket as any);

      const result = await service.startCategory('bracket-1', 'org-1', []);

      expect(spy).not.toHaveBeenCalled();
      expect(result.withdrawn).toEqual([]);
    });

    it('skips first-round matches that the bracket generator pre-resolved (BYE-paired)', async () => {
      // bracketData where match m1 already has a winner — engine-generated
      // bye. startCategory must NOT try to withdraw into it (the engine
      // would reject with "already recorded", aborting the whole loop).
      const bracket = makeBracket({
        tournament: makeTournament({
          sport: { slug: 'armwrestling', config: {} },
        }),
        bracketData: {
          players: [],
          bracketSize: 4,
          wbRounds: 1,
          winnersBracket: [
            [
              {
                id: 'm1',
                winner: 'ent-a', // pre-resolved bye
                player1: { id: 'ent-a' },
                player2: { id: 'bye' },
              },
              {
                id: 'm2',
                winner: null,
                player1: { id: 'ent-c' },
                player2: { id: 'ent-d' },
              },
            ],
          ],
          losersBracket: [],
          grandFinal: { id: 'gf' },
          superFinal: { id: 'sf', needed: false },
        },
      });
      repo.findOne.mockResolvedValue(bracket);
      entriesService.findByIds.mockResolvedValue([
        { id: 'ent-a', status: 'confirmed' }, // would be no-show, but pre-resolved
        { id: 'ent-c', status: 'pending' }, // real no-show
        { id: 'ent-d', status: 'checked_in' },
      ]);
      const spy = vi
        .spyOn(service as any, 'withdrawPlayer')
        .mockResolvedValue(bracket as any);

      const result = await service.startCategory('bracket-1', 'org-1', []);

      // Only m2's no-show (ent-c) should trigger a withdraw — m1 is
      // skipped because it already has a winner.
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        'bracket-1',
        'm2',
        expect.objectContaining({ position: 1 }),
        'org-1',
        [],
      );
      expect(result.withdrawn).toEqual(['ent-c']);
    });

    it('collects per-match errors and keeps going instead of aborting the loop', async () => {
      const bracket = withFirstRound([
        { id: 'm1', p1: 'ent-a', p2: 'ent-b' },
        { id: 'm2', p1: 'ent-c', p2: 'ent-d' },
      ]);
      repo.findOne.mockResolvedValue(bracket);
      entriesService.findByIds.mockResolvedValue([
        { id: 'ent-a', status: 'pending' }, // no-show
        { id: 'ent-b', status: 'checked_in' },
        { id: 'ent-c', status: 'pending' }, // no-show
        { id: 'ent-d', status: 'checked_in' },
      ]);
      // First call rejects (simulate concurrent edit / engine refusal),
      // second call succeeds — the loop must not abort.
      const spy = vi
        .spyOn(service as any, 'withdrawPlayer')
        .mockRejectedValueOnce(new Error('concurrent edit'))
        .mockResolvedValueOnce(bracket as any);

      const result = await service.startCategory('bracket-1', 'org-1', []);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(result.errors).toEqual([
        { matchId: 'm1', error: 'concurrent edit' },
      ]);
      expect(result.withdrawn).toEqual(['ent-c']);
    });

    it('ignores TBD / BYE slots', async () => {
      const bracket = withFirstRound([
        { id: 'm1', p1: 'tbd', p2: 'ent-b' },
        { id: 'm2', p1: 'ent-c', p2: 'bye' },
      ]);
      repo.findOne.mockResolvedValue(bracket);
      entriesService.findByIds.mockResolvedValue([
        { id: 'ent-b', status: 'checked_in' },
        { id: 'ent-c', status: 'checked_in' },
      ]);
      const spy = vi
        .spyOn(service as any, 'withdrawPlayer')
        .mockResolvedValue(bracket as any);

      const result = await service.startCategory('bracket-1', 'org-1', []);

      expect(spy).not.toHaveBeenCalled();
      expect(result.withdrawn).toEqual([]);
    });

    it('requires organizer/admin — rejects a random user', async () => {
      const bracket = withFirstRound([{ id: 'm1', p1: 'ent-a', p2: 'ent-b' }]);
      repo.findOne.mockResolvedValue(bracket);

      await expect(service.startCategory('bracket-1', 'not-organizer', [])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects locked brackets', async () => {
      const bracket = withFirstRound([{ id: 'm1', p1: 'ent-a', p2: 'ent-b' }]);
      bracket.isLocked = true;
      repo.findOne.mockResolvedValue(bracket);

      await expect(service.startCategory('bracket-1', 'org-1', [])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Phase 4 / Task 23: armfight scoring endpoints ─────────
  describe('armfight scoring', () => {
    function makeArmfightBracketData() {
      return {
        format: 'armfight' as const,
        players: [
          { id: 'p1', firstName: 'A', lastName: '1', number: '1' },
          { id: 'p2', firstName: 'B', lastName: '2', number: '2' },
        ],
        bracketSize: 2,
        wbRounds: 1,
        winnersBracket: [
          [
            {
              id: 'wb_1_0',
              round: 1,
              matchIndex: 0,
              player1: { id: 'p1', firstName: 'A', lastName: '1', number: '1' },
              player2: { id: 'p2', firstName: 'B', lastName: '2', number: '2' },
              winner: null,
              loser: null,
              result: { hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'pending' },
            },
          ],
        ],
        losersBracket: [],
        grandFinal: {
          id: 'gf',
          player1: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' },
          player2: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' },
          winner: null,
          loser: null,
        },
        superFinal: {
          id: 'sf',
          player1: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' },
          player2: { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' },
          winner: null,
          loser: null,
          needed: false,
        },
        champion: null,
        status: 'active' as const,
      };
    }

    it('recordLegResult: invokes engine.recordLeg, saves, broadcasts', async () => {
      const { recordLeg } = await import('@gsm/bracket-engine');
      const tournament = makeTournament({});
      const bracket = makeBracket({
        tournament,
        bracketData: makeArmfightBracketData() as any,
      });
      repo.findOne.mockResolvedValue(bracket);
      await service.recordLegResult(
        bracket.id,
        { boutId: 'wb_1_0', legIndex: 1, winnerId: 'p1', winType: 'pin' } as any,
        tournament.organizerId,
        ['organizer'],
      );
      expect(recordLeg).toHaveBeenCalled();
    });

    it('recordLegResult: forbidden when caller is neither organizer/operator/referee/admin', async () => {
      const tournament = makeTournament({ organizerId: 'OWNER' });
      const bracket = makeBracket({
        tournament,
        bracketData: makeArmfightBracketData() as any,
      });
      repo.findOne.mockResolvedValue(bracket);
      await expect(
        service.recordLegResult(
          bracket.id,
          { boutId: 'wb_1_0', legIndex: 1, winnerId: 'p1', winType: 'pin' } as any,
          'SOMEONE_ELSE',
          [],
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forfeitBoutById: invokes engine.forfeitBout', async () => {
      const { forfeitBout } = await import('@gsm/bracket-engine');
      const tournament = makeTournament({});
      const bracket = makeBracket({
        tournament,
        bracketData: makeArmfightBracketData() as any,
      });
      repo.findOne.mockResolvedValue(bracket);
      await service.forfeitBoutById(
        bracket.id,
        { boutId: 'wb_1_0', winnerId: 'p1', walkoverReason: 'injury' } as any,
        tournament.organizerId,
        ['organizer'],
      );
      expect(forfeitBout).toHaveBeenCalled();
    });

    it('listBouts: returns BoutSnapshot[] derived from winnersBracket[0]', async () => {
      const tournament = makeTournament({});
      const bracket = makeBracket({
        tournament,
        bracketData: makeArmfightBracketData() as any,
      });
      repo.findOne.mockResolvedValue(bracket);
      const out = await service.listBouts(bracket.id);
      expect(Array.isArray(out)).toBe(true);
      expect(out[0].boutId).toBe('wb_1_0');
      expect(out[0].hand).toBe('right');
      expect(out[0].scoreA).toBe(0);
      expect(out[0].status).toBe('pending');
    });

    it('listBouts: throws when bracket is not armfight', async () => {
      const tournament = makeTournament({});
      const bracket = makeBracket({
        tournament,
        bracketData: { format: 'double_elim', winnersBracket: [[]] } as any,
      });
      repo.findOne.mockResolvedValue(bracket);
      await expect(service.listBouts(bracket.id)).rejects.toThrow(/armfight/i);
    });

    it('recordLegResult: rejects on non-armfight bracket', async () => {
      const tournament = makeTournament({});
      const bracket = makeBracket({
        tournament,
        bracketData: { format: 'double_elim', winnersBracket: [[]] } as any,
      });
      repo.findOne.mockResolvedValue(bracket);
      await expect(
        service.recordLegResult(
          bracket.id,
          { boutId: 'wb_1_0', legIndex: 1, winnerId: 'p1', winType: 'pin' } as any,
          tournament.organizerId,
          ['organizer'],
        ),
      ).rejects.toThrow(/armfight/i);
    });

    it('forfeitBoutById: rejects on non-armfight bracket', async () => {
      const tournament = makeTournament({});
      const bracket = makeBracket({
        tournament,
        bracketData: { format: 'double_elim', winnersBracket: [[]] } as any,
      });
      repo.findOne.mockResolvedValue(bracket);
      await expect(
        service.forfeitBoutById(
          bracket.id,
          { boutId: 'wb_1_0', winnerId: 'p1' } as any,
          tournament.organizerId,
          ['organizer'],
        ),
      ).rejects.toThrow(/armfight/i);
    });

    it('recordLegResult: refuses when bracket is locked (non-admin)', async () => {
      const tournament = makeTournament({});
      const bracket = makeBracket({
        tournament,
        bracketData: makeArmfightBracketData() as any,
        isLocked: true,
      });
      repo.findOne.mockResolvedValue(bracket);
      await expect(
        service.recordLegResult(
          bracket.id,
          { boutId: 'wb_1_0', legIndex: 1, winnerId: 'p1', winType: 'pin' } as any,
          tournament.organizerId,
          ['organizer'],
        ),
      ).rejects.toThrow(/locked/i);
    });

    it('recordLegResult: maps engine validation errors to BadRequest', async () => {
      const { recordLeg } = await import('@gsm/bracket-engine');
      (recordLeg as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('recordLeg: legIndex 5 is out of order (expected 1)');
      });
      const tournament = makeTournament({});
      const bracket = makeBracket({
        tournament,
        bracketData: makeArmfightBracketData() as any,
      });
      repo.findOne.mockResolvedValue(bracket);
      await expect(
        service.recordLegResult(
          bracket.id,
          { boutId: 'wb_1_0', legIndex: 5, winnerId: 'p1', winType: 'pin' } as any,
          tournament.organizerId,
          ['organizer'],
        ),
      ).rejects.toThrow(/out of order/i);
    });

    it('recordLegResult: rethrows non-engine errors (does not mask bugs)', async () => {
      const { recordLeg } = await import('@gsm/bracket-engine');
      (recordLeg as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new TypeError('Cannot read property of undefined');
      });
      const tournament = makeTournament({});
      const bracket = makeBracket({
        tournament,
        bracketData: makeArmfightBracketData() as any,
      });
      repo.findOne.mockResolvedValue(bracket);
      await expect(
        service.recordLegResult(
          bracket.id,
          { boutId: 'wb_1_0', legIndex: 1, winnerId: 'p1', winType: 'pin' } as any,
          tournament.organizerId,
          ['organizer'],
        ),
      ).rejects.toThrow(TypeError);
    });

    it('recordLegResult: bumps lastModifiedBy / At / modificationCount on success', async () => {
      const tournament = makeTournament({});
      const bracket = makeBracket({
        tournament,
        bracketData: makeArmfightBracketData() as any,
        modificationCount: 7,
      });
      repo.findOne.mockResolvedValue(bracket);
      let savedBracket: any = null;
      repo.save.mockImplementation((b: any) => {
        savedBracket = b;
        return Promise.resolve(b);
      });
      await service.recordLegResult(
        bracket.id,
        { boutId: 'wb_1_0', legIndex: 1, winnerId: 'p1', winType: 'pin' } as any,
        tournament.organizerId,
        ['organizer'],
      );
      expect(savedBracket.lastModifiedBy).toBe(tournament.organizerId);
      expect(savedBracket.lastModifiedAt).toBeInstanceOf(Date);
      expect(savedBracket.modificationCount).toBe(8);
    });
  });
});
