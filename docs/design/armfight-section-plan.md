# Armfight Section & Main-Event Countdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship sub-project A — public armfight discovery + an admin-flagged main-event hero with a live full countdown — reusing the existing `Tournament` model.

**Architecture:** An "armfight event" is an existing `Tournament` whose armfight nature is detected by a single defensive predicate (`format === 'armfight'` OR `sportConfig.competitionType === 'armfight'`). The "main event" reuses the **already-existing** `Tournament.isFeatured` flag (no new featured column). Poster (`posterUrl`) and future stream (`streamUrl`) columns **already exist**. The **only** new column is `armfightVideoUrl`. Backend adds one service method + one public endpoint; frontend adds a shared presentational hero + a client countdown + SSR-friendly wrappers, mounted on home, the sport page, and the tournaments page.

**Tech Stack:** NestJS, TypeORM (generated migration), Vitest (`getRepositoryToken` mocks), Next.js App Router, React Query, next-intl (`armfight` namespace, ICU plurals), Combat Energy CSS tokens, `@testing-library/react`.

---

## Spec Reconciliation (read before starting)

The spec (`docs/design/armfight-section.md`) was written before the code was read. Reality differs — this plan is the source of truth:

1. **No `is_featured_armfight` column.** `Tournament.isFeatured` already exists (entity line 97-98) and the admin wizard DTO already accepts `isFeatured`. Reuse it. "Featured armfight" = `isFeatured && isArmfight(t)`.
2. **No poster/stream migration.** `posterUrl` and `streamUrl` already exist on the entity and admin DTO.
3. **Only new column:** `armfightVideoUrl` (nullable varchar) — the post-event recording/YouTube link.
4. **Armfight identity is not a reliable single field.** Admin `CreateTournamentDto` has **no `format` field**; the wizard models `competitionType: 'setka' | 'armfight'`. So detection must be defensive (check both `format` and `sportConfig.competitionType`). A single shared predicate isolates this.
5. **`AdminService.updateTournament` refuses ALL edits when `bracketGenerated`** (admin.service.ts:121-123) and strips `weightCategories` (line 124). Spec §8 requires flagging a main event / setting a video link to work **even after a bracket exists**. Task 2 adds a narrow exception for the three promo scalars only.

---

## File Structure

**Backend (`apps/api`):**
- Modify `src/tournaments/entities/tournament.entity.ts` — add `armfightVideoUrl`.
- Create `src/migrations/<ts>-AddArmfightVideoUrl.ts` — generated.
- Modify `src/admin/dto/create-tournament.dto.ts` — add `armfightVideoUrl`.
- Modify `src/admin/admin.service.ts` — promo-fields exception when `bracketGenerated`.
- Modify `src/admin/admin.service.spec.ts` — cover the exception.
- Modify `src/tournaments/tournaments.service.ts` — `findFeaturedArmfight()` + `competitionType`/armfight filter in `findAll`.
- Modify `src/tournaments/tournaments.service.spec.ts` — cover new logic.
- Modify `src/tournaments/tournaments.controller.ts` — `GET /v1/tournaments/featured-armfight` + `format` query.

**Shared predicate:**
- Create `apps/web/src/lib/armfight.ts` + `apps/web/src/lib/armfight.spec.ts`.

**Frontend (`apps/web`):**
- Modify `src/types/api.ts` — add `armfightVideoUrl`.
- Modify `src/hooks/useTournaments.ts` — `format` param, `useFeaturedArmfight`, `useUpcomingArmfights`.
- Modify `src/lib/api-server.ts` — `fetchFeaturedArmfight`.
- Create `src/components/armfight/useCountdown.ts` + `.spec.ts`.
- Create `src/components/armfight/Countdown.tsx` + `.spec.tsx`.
- Create `src/components/armfight/MainArmfightHero.tsx` (presentational) + `.spec.tsx`.
- Create `src/components/armfight/MainArmfightHeroClient.tsx` (client, hook-driven — home).
- Create `src/components/armfight/MainArmfightHeroServer.tsx` (server, SSR fetch — sport/tournaments).
- Create `src/components/armfight/MainArmfightMiniCard.tsx` + `.spec.tsx`.
- Create `src/components/armfight/UpcomingArmfights.tsx` (server section).
- Modify `src/app/page.tsx`, `src/app/sport/[sport]/page.tsx`, `src/app/tournaments/page.tsx` — mount points.
- Modify `src/messages/{ru,en,hy}.json` — `armfight` namespace.

---

## Task 1: Add `armfightVideoUrl` column + migration

**Files:**
- Modify: `apps/api/src/tournaments/entities/tournament.entity.ts:107`
- Create: `apps/api/src/migrations/<generated>-AddArmfightVideoUrl.ts`

- [ ] **Step 1: Add the column to the entity**

In `tournament.entity.ts`, immediately after the `streamUrl` column (line 106-107), add:

```ts
  @Column({ type: 'varchar', length: 500, nullable: true })
  armfightVideoUrl: string | null;
```

- [ ] **Step 2: Generate the migration**

Run: `cd apps/api && npx typeorm migration:generate ./src/migrations/AddArmfightVideoUrl -d ./src/data-source.ts`
Expected: a new file under `src/migrations/` containing `ADD "armfightVideoUrl"` in `up()` and `DROP COLUMN` in `down()`.
(If the data-source path differs, find it: `ls apps/api/src/data-source.ts apps/api/src/*data-source* 2>/dev/null` and use the real path; do not hand-write the migration.)

- [ ] **Step 3: Apply and verify revert**

Run: `cd apps/api && npx typeorm migration:run -d ./src/data-source.ts && npx typeorm migration:revert -d ./src/data-source.ts && npx typeorm migration:run -d ./src/data-source.ts`
Expected: run → revert → run all succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/tournaments/entities/tournament.entity.ts apps/api/src/migrations/
git commit -m "feat(db): add armfight_video_url column to tournaments"
```

---

## Task 2: Allow promo scalars through admin update after bracket generation

**Files:**
- Modify: `apps/api/src/admin/dto/create-tournament.dto.ts:129`
- Modify: `apps/api/src/admin/admin.service.ts:114-127`
- Test: `apps/api/src/admin/admin.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to `admin.service.spec.ts` (follow the file's existing harness — repo mocks via `getRepositoryToken`, `makeTournament` helper if present; otherwise mirror the `tournaments.service.spec.ts` style):

```ts
describe('updateTournament — promo fields after bracket', () => {
  it('allows isFeatured / armfightVideoUrl / streamUrl when bracketGenerated, ignoring other fields', async () => {
    const t = makeTournament({ id: 'tid', bracketGenerated: true, organizerId: 'u1' });
    tournamentsRepo.findOne.mockResolvedValue(t);
    tournamentsRepo.update.mockResolvedValue(undefined);

    await service.updateTournament(
      'tid',
      { isFeatured: true, armfightVideoUrl: 'https://youtu.be/x', name: 'HACK' } as any,
      'u1',
      ['admin'],
    );

    expect(tournamentsRepo.update).toHaveBeenCalledWith('tid', {
      isFeatured: true,
      armfightVideoUrl: 'https://youtu.be/x',
    });
  });

  it('still rejects non-promo edits when bracketGenerated', async () => {
    const t = makeTournament({ id: 'tid', bracketGenerated: true, organizerId: 'u1' });
    tournamentsRepo.findOne.mockResolvedValue(t);
    await expect(
      service.updateTournament('tid', { name: 'New' } as any, 'u1', ['admin']),
    ).rejects.toThrow(BadRequestException);
  });
});
```

If `admin.service.spec.ts` has no `makeTournament`, copy the `makeTournament` factory from `apps/api/src/tournaments/tournaments.service.spec.ts:79-113` into the admin spec.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/admin/admin.service.spec.ts -t "promo fields after bracket"`
Expected: FAIL (current code throws `BadRequestException` for any field when `bracketGenerated`).

- [ ] **Step 3: Add the DTO field**

In `apps/api/src/admin/dto/create-tournament.dto.ts`, after the `streamUrl` block (line 126-129), add:

```ts
  @ApiProperty({ required: false, description: 'Recording / YouTube link shown post-event' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  armfightVideoUrl?: string;
```

(`UpdateTournamentDto extends PartialType(CreateTournamentDto)` so it inherits automatically.)

- [ ] **Step 4: Implement the narrow exception**

Replace `AdminService.updateTournament` body (admin.service.ts:114-127) with:

```ts
  async updateTournament(
    id: string,
    dto: UpdateTournamentDto,
    userId: string,
    userRoles: string[],
  ): Promise<Tournament> {
    const t = await this.getTournament(id, userId, userRoles);
    const { weightCategories: _wc, ...updateFields } = dto as any;

    if (t.bracketGenerated) {
      // After a bracket exists the event is frozen — EXCEPT promo-only
      // scalars that never affect the bracket (feature flag, video link,
      // future stream link). Anything else is rejected.
      const PROMO_KEYS = ['isFeatured', 'armfightVideoUrl', 'streamUrl'] as const;
      const promo: Record<string, unknown> = {};
      for (const k of PROMO_KEYS) {
        if (updateFields[k] !== undefined) promo[k] = updateFields[k];
      }
      const hasNonPromo = Object.keys(updateFields).some(
        (k) => !(PROMO_KEYS as readonly string[]).includes(k),
      );
      if (hasNonPromo || Object.keys(promo).length === 0) {
        throw new BadRequestException(
          'Cannot edit tournament after bracket has been generated',
        );
      }
      await this.tournamentsRepository.update(id, promo);
      return this.getTournament(id, userId, userRoles);
    }

    await this.tournamentsRepository.update(id, updateFields);
    return this.getTournament(id, userId, userRoles);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/admin/admin.service.spec.ts`
Expected: PASS (new tests + all existing admin tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/admin/dto/create-tournament.dto.ts apps/api/src/admin/admin.service.ts apps/api/src/admin/admin.service.spec.ts
git commit -m "feat(api): allow promo scalars on admin tournament update post-bracket"
```

---

## Task 3: Featured-armfight selection + armfight list filter (service)

**Files:**
- Modify: `apps/api/src/tournaments/tournaments.service.ts:24-71`
- Test: `apps/api/src/tournaments/tournaments.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tournaments.service.spec.ts` (the `makeQb`, `mockTournamentsRepo`, `makeTournament` helpers already exist in this file):

```ts
describe('findAll — competitionType filter', () => {
  it('filters armfight events by format OR sportConfig.competitionType', async () => {
    const qb = makeQb([[], 0]);
    tournamentsRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll({ format: 'armfight' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      "(t.format = :fmt OR t.sportConfig ->> 'competitionType' = :fmt)",
      { fmt: 'armfight' },
    );
  });
});

describe('findFeaturedArmfight', () => {
  it('returns the soonest non-terminal featured armfight', async () => {
    const qb = makeQb();
    qb.getOne = vi.fn().mockResolvedValue(makeTournament({ isFeatured: true }));
    tournamentsRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findFeaturedArmfight();

    expect(result?.isFeatured).toBe(true);
    expect(qb.andWhere).toHaveBeenCalledWith('t.isFeatured = :f', { f: true });
    expect(qb.andWhere).toHaveBeenCalledWith('t.status NOT IN (:...terminal)', {
      terminal: ['completed', 'cancelled'],
    });
    expect(qb.orderBy).toHaveBeenCalledWith('t.startDate', 'ASC');
  });

  it('returns null when none is set', async () => {
    const qb = makeQb();
    qb.getOne = vi.fn().mockResolvedValue(null);
    tournamentsRepo.createQueryBuilder.mockReturnValue(qb);

    expect(await service.findFeaturedArmfight()).toBeNull();
  });
});
```

Extend the `makeQb` helper in this spec (line 14-24) to also expose `getOne`:

```ts
const makeQb = (result: [Tournament[], number] = [[], 0]) => {
  const qb: any = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue(result),
    getOne: vi.fn().mockResolvedValue(null),
  };
  return qb;
};
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/tournaments/tournaments.service.spec.ts -t "competitionType filter|findFeaturedArmfight"`
Expected: FAIL (`service.findFeaturedArmfight is not a function`; filter not applied).

- [ ] **Step 3: Implement**

In `tournaments.service.ts`, extend `FindAllOptions` (line 24-30):

```ts
interface FindAllOptions {
  sport?: string;
  status?: string;
  country?: string;
  format?: string;
  page?: number;
  limit?: number;
}
```

In `findAll` (after the `country` filter, line 67) add:

```ts
    if (format === 'armfight') {
      qb.andWhere("(t.format = :fmt OR t.sportConfig ->> 'competitionType' = :fmt)", {
        fmt: 'armfight',
      });
    } else if (format) {
      qb.andWhere('t.format = :fmt', { fmt: format });
    }
```

and destructure `format` in the options line (line 53):

```ts
    const { sport, status, country, format, page = 1, limit = 20 } = options;
```

Add this method after `findById` (line 89):

```ts
  /**
   * The single "main event" armfight for promo surfaces. Reuses the generic
   * `isFeatured` flag (admin-set in the wizard). Excludes terminal events so
   * a finished/cancelled flagged tournament drops out automatically. Soonest
   * by startDate when several are flagged. Null when none.
   */
  async findFeaturedArmfight(): Promise<Tournament | null> {
    const qb = this.tournamentsRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sport', 'sport')
      .andWhere('t.isFeatured = :f', { f: true })
      .andWhere(
        "(t.format = :fmt OR t.sportConfig ->> 'competitionType' = :fmt)",
        { fmt: 'armfight' },
      )
      .andWhere('t.status NOT IN (:...terminal)', {
        terminal: ['completed', 'cancelled'],
      })
      .orderBy('t.startDate', 'ASC');
    return (await qb.getOne()) ?? null;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/tournaments/tournaments.service.spec.ts`
Expected: PASS (new + all existing).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/tournaments/tournaments.service.ts apps/api/src/tournaments/tournaments.service.spec.ts
git commit -m "feat(api): add featured-armfight selection and armfight list filter"
```

---

## Task 4: Public endpoint + `format` query param (controller)

**Files:**
- Modify: `apps/api/src/tournaments/tournaments.controller.ts:86-107`

- [ ] **Step 1: Add the `format` query param to `findAll`**

Replace the `findAll` controller method (lines 86-101) with:

```ts
  @Public()
  @Get()
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'format', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('sport') sport?: string,
    @Query('status') status?: string,
    @Query('country') country?: string,
    @Query('format') format?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.tournamentsService.findAll({ sport, status, country, format, page, limit });
  }
```

- [ ] **Step 2: Add the featured-armfight endpoint**

Insert **before** the `@Get(':slug')` route (line 103) — order matters so `featured-armfight` is not captured by `:slug`:

```ts
  @Public()
  @Get('featured-armfight')
  @HttpCode(HttpStatus.OK)
  async featuredArmfight(@Res({ passthrough: true }) res: import('express').Response) {
    const t = await this.tournamentsService.findFeaturedArmfight();
    if (!t) {
      res.status(HttpStatus.NO_CONTENT);
      return undefined;
    }
    return t;
  }
```

Add `Res` to the `@nestjs/common` import list at the top of the file (line 1-14).

- [ ] **Step 3: Verify route ordering by smoke test**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: no type errors.
Then (if a dev DB is available): `curl -s -i localhost:4000/v1/tournaments/featured-armfight | head -1` → `HTTP/1.1 200` or `204`, never a "Tournament 'featured-armfight' not found" 404.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/tournaments/tournaments.controller.ts
git commit -m "feat(api): expose GET /v1/tournaments/featured-armfight + format filter"
```

---

## Task 5: Shared armfight predicate + frontend data layer

**Files:**
- Create: `apps/web/src/lib/armfight.ts`
- Test: `apps/web/src/lib/armfight.spec.ts`
- Modify: `apps/web/src/types/api.ts:94`
- Modify: `apps/web/src/hooks/useTournaments.ts:13-30`
- Modify: `apps/web/src/lib/api-server.ts`

- [ ] **Step 1: Write the failing predicate test**

Create `apps/web/src/lib/armfight.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isArmfightTournament } from './armfight';
import type { Tournament } from '@/types/api';

const base = { format: 'double_elimination', sportConfig: null } as unknown as Tournament;

describe('isArmfightTournament', () => {
  it('true when format is armfight', () => {
    expect(isArmfightTournament({ ...base, format: 'armfight' })).toBe(true);
  });
  it('true when sportConfig.competitionType is armfight', () => {
    expect(
      isArmfightTournament({ ...base, sportConfig: { competitionType: 'armfight' } }),
    ).toBe(true);
  });
  it('false otherwise', () => {
    expect(isArmfightTournament(base)).toBe(false);
  });
  it('false on null-ish input', () => {
    expect(isArmfightTournament(null as unknown as Tournament)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/armfight.spec.ts`
Expected: FAIL ("Failed to resolve import './armfight'").

- [ ] **Step 3: Implement the predicate + add the type field**

Create `apps/web/src/lib/armfight.ts`:

```ts
import type { Tournament } from '@/types/api';

/** Single source of truth for "is this an armfight event". Defensive: the
 *  wizard may persist the choice as `format` or in `sportConfig`. */
export function isArmfightTournament(t: Tournament | null | undefined): boolean {
  if (!t) return false;
  if (t.format === 'armfight') return true;
  const ct = t.sportConfig?.competitionType;
  return ct === 'armfight';
}
```

In `apps/web/src/types/api.ts`, in the `Tournament` interface after `streamUrl` (line 94) add:

```ts
  armfightVideoUrl: string | null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/armfight.spec.ts`
Expected: PASS.

- [ ] **Step 5: Add data hooks + SSR fetch**

In `apps/web/src/hooks/useTournaments.ts`, add `format` to `TournamentsParams` (line 13-19):

```ts
interface TournamentsParams {
  sport?: string;
  status?: string;
  country?: string;
  format?: string;
  page?: number;
  limit?: number;
}
```

Append these two hooks at the end of the file:

```ts
export function useFeaturedArmfight(options?: { initialData?: Tournament | null }) {
  return useQuery<Tournament | null>({
    queryKey: ['featured-armfight'],
    queryFn: () =>
      api
        .get('/tournaments/featured-armfight')
        .then((r: { status: number; data: any }) => (r.status === 204 ? null : r.data)),
    initialData: options?.initialData,
    staleTime: 60_000,
  });
}

export function useUpcomingArmfights(
  options?: { initialData?: PaginatedResponse<Tournament> },
) {
  return useQuery<PaginatedResponse<Tournament>>({
    queryKey: ['tournaments', { format: 'armfight', status: 'upcoming' }],
    queryFn: () =>
      api
        .get('/tournaments', { params: { format: 'armfight', limit: 50 } })
        .then((r: { data: any }) => r.data),
    initialData: options?.initialData,
  });
}
```

In `apps/web/src/lib/api-server.ts` append:

```ts
export async function fetchFeaturedArmfight(): Promise<Tournament | null> {
  try {
    const res = await fetch(`${API_URL}/tournaments/featured-armfight`, {
      next: { revalidate: 30 },
    });
    if (res.status === 204 || !res.ok) return null;
    return (await res.json()) as Tournament;
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

```bash
git add apps/web/src/lib/armfight.ts apps/web/src/lib/armfight.spec.ts apps/web/src/types/api.ts apps/web/src/hooks/useTournaments.ts apps/web/src/lib/api-server.ts
git commit -m "feat(web): armfight predicate + featured/upcoming data layer"
```

---

## Task 6: `useCountdown` pure hook + tests

**Files:**
- Create: `apps/web/src/components/armfight/useCountdown.ts`
- Test: `apps/web/src/components/armfight/useCountdown.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/armfight/useCountdown.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { diffParts } from './useCountdown';

describe('diffParts', () => {
  it('breaks a positive diff into d/h/m/s with zero-padding', () => {
    const target = new Date('2026-01-03T01:02:03Z').getTime();
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    expect(diffParts(target, now)).toEqual({
      ended: false, days: 2, hours: 1, minutes: 2, seconds: 3,
      dd: '02', hh: '01', mm: '02', ss: '03',
    });
  });
  it('clamps to zero and flags ended when target is in the past', () => {
    const now = new Date('2026-01-02T00:00:00Z').getTime();
    const target = new Date('2026-01-01T00:00:00Z').getTime();
    expect(diffParts(target, now)).toEqual({
      ended: true, days: 0, hours: 0, minutes: 0, seconds: 0,
      dd: '00', hh: '00', mm: '00', ss: '00',
    });
  });
  it('handles large day counts without overflow into "hours"', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    const target = new Date('2026-02-10T00:00:00Z').getTime(); // 40 days
    expect(diffParts(target, now).days).toBe(40);
    expect(diffParts(target, now).dd).toBe('40');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && npx vitest run src/components/armfight/useCountdown.spec.ts`
Expected: FAIL (cannot resolve `./useCountdown`).

- [ ] **Step 3: Implement**

Create `apps/web/src/components/armfight/useCountdown.ts`:

```ts
'use client';
import { useEffect, useState } from 'react';

export interface CountdownParts {
  ended: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  dd: string;
  hh: string;
  mm: string;
  ss: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Pure: target/now epoch ms -> parts. Exported for unit testing. */
export function diffParts(targetMs: number, nowMs: number): CountdownParts {
  let s = Math.floor((targetMs - nowMs) / 1000);
  if (s <= 0) {
    return {
      ended: true, days: 0, hours: 0, minutes: 0, seconds: 0,
      dd: '00', hh: '00', mm: '00', ss: '00',
    };
  }
  const days = Math.floor(s / 86400);
  s -= days * 86400;
  const hours = Math.floor(s / 3600);
  s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  const seconds = s - minutes * 60;
  return {
    ended: false, days, hours, minutes, seconds,
    dd: pad(days), hh: pad(hours), mm: pad(minutes), ss: pad(seconds),
  };
}

/** SSR-safe: renders a server snapshot, then ticks every second after mount
 *  (no hydration mismatch — first client render equals the server render). */
export function useCountdown(targetIso: string): CountdownParts {
  const targetMs = new Date(targetIso).getTime();
  const [nowMs, setNowMs] = useState(() => targetMs - 1000); // placeholder; replaced on mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Before mount: stable, non-ticking snapshot to keep SSR/CSR identical.
  return mounted ? diffParts(targetMs, nowMs) : diffParts(targetMs, targetMs - 1000);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/components/armfight/useCountdown.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/armfight/useCountdown.ts apps/web/src/components/armfight/useCountdown.spec.ts
git commit -m "feat(web): add useCountdown hook with pure diffParts logic"
```

---

## Task 7: `Countdown` component + test

**Files:**
- Create: `apps/web/src/components/armfight/Countdown.tsx`
- Test: `apps/web/src/components/armfight/Countdown.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/armfight/Countdown.spec.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

import { Countdown } from './Countdown';

describe('Countdown', () => {
  it('renders four padded boxes for a far-future target', () => {
    const future = new Date(Date.now() + 2 * 86400_000 + 3600_000).toISOString();
    render(<Countdown targetIso={future} />);
    expect(screen.getByTestId('cd-days')).toHaveTextContent('02');
    expect(screen.getByTestId('cd-hours')).toBeInTheDocument();
    expect(screen.getByTestId('cd-mins')).toBeInTheDocument();
    expect(screen.getByTestId('cd-secs')).toBeInTheDocument();
  });

  it('renders a LIVE badge instead of boxes once the target passed', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    render(<Countdown targetIso={past} />);
    expect(screen.getByTestId('cd-live')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && npx vitest run src/components/armfight/Countdown.spec.tsx`
Expected: FAIL (cannot resolve `./Countdown`).

- [ ] **Step 3: Implement**

Create `apps/web/src/components/armfight/Countdown.tsx`:

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { useCountdown } from './useCountdown';

function Box({ value, label, testid, hot }: {
  value: string; label: string; testid: string; hot?: boolean;
}) {
  return (
    <div
      data-testid={testid}
      className="rounded-lg px-4 py-3 min-w-[72px] text-center"
      style={{
        background: hot ? 'rgba(200,16,46,0.12)' : 'rgba(15,15,26,0.45)',
        border: `1px solid ${hot ? 'var(--color-primary)' : 'rgba(255,255,255,0.35)'}`,
      }}
    >
      <div className="text-3xl font-black text-white leading-none">{value}</div>
      <div
        className="text-[10px] tracking-widest mt-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </div>
    </div>
  );
}

export function Countdown({ targetIso }: { targetIso: string }) {
  const t = useTranslations('armfight');
  const c = useCountdown(targetIso);

  if (c.ended) {
    return (
      <span
        data-testid="cd-live"
        className="inline-block text-sm font-black uppercase tracking-widest px-4 py-2 rounded-full animate-pulse"
        style={{ background: 'var(--color-primary)', color: '#fff' }}
      >
        {t('live')}
      </span>
    );
  }

  return (
    <div className="flex gap-3" data-testid="cd-root">
      <Box testid="cd-days" value={c.dd} label={t('days')} />
      <Box testid="cd-hours" value={c.hh} label={t('hours')} />
      <Box testid="cd-mins" value={c.mm} label={t('minutes')} />
      <Box testid="cd-secs" value={c.ss} label={t('seconds')} hot />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/armfight/Countdown.spec.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/armfight/Countdown.tsx apps/web/src/components/armfight/Countdown.spec.tsx
git commit -m "feat(web): add Countdown component (Combat Energy styled)"
```

---

## Task 8: Hero (presentational + wrappers) and mini-card

**Files:**
- Create: `apps/web/src/components/armfight/MainArmfightHero.tsx`
- Create: `apps/web/src/components/armfight/MainArmfightHeroClient.tsx`
- Create: `apps/web/src/components/armfight/MainArmfightHeroServer.tsx`
- Create: `apps/web/src/components/armfight/MainArmfightMiniCard.tsx`
- Test: `apps/web/src/components/armfight/MainArmfightHero.spec.tsx`
- Test: `apps/web/src/components/armfight/MainArmfightMiniCard.spec.tsx`

- [ ] **Step 1: Write the failing hero tests**

Create `apps/web/src/components/armfight/MainArmfightHero.spec.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/link', () => ({ default: ({ children }: any) => <a>{children}</a> }));
vi.mock('next/image', () => ({ default: (p: any) => <img alt={p.alt} /> }));

import { MainArmfightHero } from './MainArmfightHero';
import type { Tournament } from '@/types/api';

const t = (o: Partial<Tournament> = {}): Tournament => ({
  id: '1', slug: 's', name: 'ARMFIGHT NIGHT', nameRu: null, nameEn: null, nameHy: null,
  descriptionRu: null, descriptionEn: null, descriptionHy: null,
  startDate: new Date(Date.now() + 86400_000).toISOString(), endDate: null,
  location: null, country: null, city: 'Yerevan', format: 'armfight',
  maxParticipants: null, registrationOpen: false, registrationDeadline: null,
  bracketGenerated: false, status: 'upcoming', isFeatured: true, isLive: false,
  posterUrl: null, streamUrl: null, armfightVideoUrl: null, sport: null,
  weightCategories: [], sportConfig: null, ...o,
});

describe('MainArmfightHero', () => {
  it('renders nothing when tournament is null', () => {
    const { container } = render(<MainArmfightHero tournament={null} />);
    expect(container.firstChild).toBeNull();
  });
  it('renders nothing when the event is completed', () => {
    const { container } = render(<MainArmfightHero tournament={t({ status: 'completed' })} />);
    expect(container.firstChild).toBeNull();
  });
  it('shows the title and countdown when upcoming', () => {
    render(<MainArmfightHero tournament={t()} />);
    expect(screen.getByText('ARMFIGHT NIGHT')).toBeInTheDocument();
    expect(screen.getByTestId('cd-root')).toBeInTheDocument();
  });
  it('omits the weight/title badge when none is set', () => {
    render(<MainArmfightHero tournament={t({ sportConfig: null })} />);
    expect(screen.queryByTestId('af-badge')).toBeNull();
  });
  it('shows the weight/title badge when set', () => {
    render(<MainArmfightHero tournament={t({ sportConfig: { weightTitle: '+105 КГ' } })} />);
    expect(screen.getByTestId('af-badge')).toHaveTextContent('+105 КГ');
  });
  it('omits the city line when city is null', () => {
    render(<MainArmfightHero tournament={t({ city: null })} />);
    expect(screen.queryByTestId('af-city')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && npx vitest run src/components/armfight/MainArmfightHero.spec.tsx`
Expected: FAIL (cannot resolve `./MainArmfightHero`).

- [ ] **Step 3: Implement the presentational hero**

Create `apps/web/src/components/armfight/MainArmfightHero.tsx`:

```tsx
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { Tournament } from '@/types/api';
import { Countdown } from './Countdown';

function weightTitle(t: Tournament): string | null {
  const v = t.sportConfig?.weightTitle;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Pure presentational hero. Returns null when there is nothing to promote
 *  (no event, or the event is terminal — finished/cancelled). */
export function MainArmfightHero({ tournament }: { tournament: Tournament | null }) {
  const tr = useTranslations('armfight');
  if (!tournament) return null;
  if (tournament.status === 'completed' || tournament.status === 'cancelled') return null;

  const badge = weightTitle(tournament);

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 30%, rgba(200,16,46,0.18), transparent 60%), linear-gradient(180deg, rgba(15,15,26,0.55), rgba(15,15,26,0.97)), linear-gradient(135deg,#241018,#15152a 55%,#0F0F1A)',
      }}
    >
      {tournament.posterUrl && (
        <Image
          src={tournament.posterUrl}
          alt={tournament.name}
          fill
          priority
          className="object-cover -z-10 opacity-60"
        />
      )}
      <div className="max-w-5xl mx-auto px-4 py-20 sm:py-28 flex flex-col items-center text-center">
        {badge && (
          <span
            data-testid="af-badge"
            className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{ background: 'var(--color-accent)', color: '#0F0F1A' }}
          >
            {badge}
          </span>
        )}
        <h2 className="text-4xl sm:text-5xl font-black text-white leading-none">
          {tournament.name}
        </h2>
        {tournament.city && (
          <p
            data-testid="af-city"
            className="mt-3 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {tournament.city} · {tr('starts_in')}
          </p>
        )}
        <div className="mt-6">
          <Countdown targetIso={tournament.startDate} />
        </div>
        <div className="mt-7 flex flex-wrap gap-3 justify-center">
          <Link
            href={`/tournaments/${tournament.slug}`}
            className="px-6 py-3 rounded-md text-sm font-black uppercase tracking-wide text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            {tr('cta_bracket')}
          </Link>
          <Link
            href={`/tournaments/${tournament.slug}`}
            className="px-6 py-3 rounded-md text-sm font-black uppercase tracking-wide border border-white/40 text-white"
          >
            {tr('cta_details')}
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run hero tests to verify they pass**

Run: `cd apps/web && npx vitest run src/components/armfight/MainArmfightHero.spec.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the server + client wrappers**

Create `apps/web/src/components/armfight/MainArmfightHeroServer.tsx`:

```tsx
import { fetchFeaturedArmfight } from '@/lib/api-server';
import { MainArmfightHero } from './MainArmfightHero';

/** Server component — SSR fetch for SEO on server-rendered pages. */
export async function MainArmfightHeroServer() {
  const tournament = await fetchFeaturedArmfight();
  return <MainArmfightHero tournament={tournament} />;
}
```

Create `apps/web/src/components/armfight/MainArmfightHeroClient.tsx`:

```tsx
'use client';
import { useFeaturedArmfight } from '@/hooks/useTournaments';
import { MainArmfightHero } from './MainArmfightHero';

/** Client component — for pages already rendered client-side (home). */
export function MainArmfightHeroClient() {
  const { data } = useFeaturedArmfight();
  return <MainArmfightHero tournament={data ?? null} />;
}
```

- [ ] **Step 6: Write the failing mini-card test**

Create `apps/web/src/components/armfight/MainArmfightMiniCard.spec.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/link', () => ({ default: ({ children }: any) => <a>{children}</a> }));

import { MainArmfightMiniCard } from './MainArmfightMiniCard';
import type { Tournament } from '@/types/api';

const base = (o: Partial<Tournament> = {}): Tournament =>
  ({
    id: '1', slug: 's', name: 'AF', startDate: new Date(Date.now() + 86400_000).toISOString(),
    status: 'upcoming', armfightVideoUrl: null, city: null, posterUrl: null,
    sportConfig: null, format: 'armfight',
  } as unknown as Tournament);

describe('MainArmfightMiniCard', () => {
  it('returns null without a tournament', () => {
    const { container } = render(<MainArmfightMiniCard tournament={null} />);
    expect(container.firstChild).toBeNull();
  });
  it('shows the video button only when finished AND a video url exists', () => {
    render(
      <MainArmfightMiniCard
        tournament={base({ status: 'completed', armfightVideoUrl: 'https://youtu.be/x' })}
      />,
    );
    expect(screen.getByTestId('af-video')).toBeInTheDocument();
  });
  it('no video button when finished but no url', () => {
    render(<MainArmfightMiniCard tournament={base({ status: 'completed' })} />);
    expect(screen.queryByTestId('af-video')).toBeNull();
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `cd apps/web && npx vitest run src/components/armfight/MainArmfightMiniCard.spec.tsx`
Expected: FAIL (cannot resolve `./MainArmfightMiniCard`).

- [ ] **Step 8: Implement the mini-card**

Create `apps/web/src/components/armfight/MainArmfightMiniCard.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Tournament } from '@/types/api';
import { Countdown } from './Countdown';

/** Compact promo for /tournaments. Upcoming/live: title + countdown.
 *  Finished: stays as a small card with a video/YouTube button (only if a
 *  link is set). Null if there is nothing to show. */
export function MainArmfightMiniCard({ tournament }: { tournament: Tournament | null }) {
  const tr = useTranslations('armfight');
  if (!tournament) return null;

  const finished = tournament.status === 'completed';
  if (finished && !tournament.armfightVideoUrl) return null;
  if (tournament.status === 'cancelled') return null;

  return (
    <div
      data-testid="af-mini"
      className="rounded-xl border border-white/10 p-4 flex items-center justify-between gap-4 mb-6"
      style={{ background: 'var(--color-surface)' }}
    >
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-widest"
             style={{ color: 'var(--color-accent)' }}>
          {tr('main_event')}
        </div>
        <Link href={`/tournaments/${tournament.slug}`}
              className="text-lg font-black text-white truncate block">
          {tournament.name}
        </Link>
      </div>
      {finished ? (
        <a
          data-testid="af-video"
          href={tournament.armfightVideoUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-4 py-2 rounded-md text-xs font-black uppercase tracking-wide text-white"
          style={{ background: 'var(--color-primary)' }}
        >
          {tr('watch_video')}
        </a>
      ) : (
        <div className="shrink-0">
          <Countdown targetIso={tournament.startDate} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Run all armfight component tests**

Run: `cd apps/web && npx vitest run src/components/armfight`
Expected: PASS (all files green).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/armfight/MainArmfightHero.tsx apps/web/src/components/armfight/MainArmfightHero.spec.tsx apps/web/src/components/armfight/MainArmfightHeroServer.tsx apps/web/src/components/armfight/MainArmfightHeroClient.tsx apps/web/src/components/armfight/MainArmfightMiniCard.tsx apps/web/src/components/armfight/MainArmfightMiniCard.spec.tsx
git commit -m "feat(web): main armfight hero (server/client) + mini-card"
```

---

## Task 9: Upcoming-armfights section + mount points

**Files:**
- Create: `apps/web/src/components/armfight/UpcomingArmfights.tsx`
- Modify: `apps/web/src/app/sport/[sport]/page.tsx`
- Modify: `apps/web/src/app/tournaments/page.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Implement the upcoming-armfights server section**

Create `apps/web/src/components/armfight/UpcomingArmfights.tsx` (mirrors the existing `_UpcomingBattles.tsx` SSR pattern — `getTranslations` from `next-intl/server`, `TournamentCard`):

```tsx
import { getTranslations } from 'next-intl/server';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { isArmfightTournament } from '@/lib/armfight';
import type { Tournament, PaginatedResponse } from '@/types/api';

const API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

async function fetchUpcomingArmfights(): Promise<Tournament[]> {
  try {
    const res = await fetch(`${API_URL}/tournaments?format=armfight&limit=50`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json: PaginatedResponse<Tournament> = await res.json();
    return (json.data ?? [])
      .filter(isArmfightTournament)
      .filter((x) => x.status !== 'completed' && x.status !== 'cancelled');
  } catch {
    return [];
  }
}

export async function UpcomingArmfights() {
  const items = await fetchUpcomingArmfights();
  const t = await getTranslations('armfight');
  return (
    <section className="px-4 py-14">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-black uppercase tracking-wide text-white mb-8">
          {t('upcoming_title')}
        </h2>
        {items.length === 0 ? (
          <p
            className="py-12 text-center border-t border-white/10"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('none_soon')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((x) => (
              <TournamentCard key={x.id} tournament={x} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

(If `TournamentCard`'s import path differs, confirm with `ls apps/web/src/components/tournaments/`. It is used by `_UpcomingBattles.tsx:3`, so the path above is correct.)

- [ ] **Step 2: Mount on the sport page**

Replace `apps/web/src/app/sport/[sport]/page.tsx` with:

```tsx
import { SportHero } from './_SportHero';
import { UpcomingBattles } from './_UpcomingBattles';
import { MainArmfightHeroServer } from '@/components/armfight/MainArmfightHeroServer';
import { UpcomingArmfights } from '@/components/armfight/UpcomingArmfights';

export default async function SportOverviewPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  return (
    <>
      <SportHero sportSlug={sport} />
      {sport === 'armwrestling' && (
        <>
          {/* @ts-expect-error Async Server Component */}
          <MainArmfightHeroServer />
          {/* @ts-expect-error Async Server Component */}
          <UpcomingArmfights />
        </>
      )}
      <UpcomingBattles sportSlug={sport} />
    </>
  );
}
```

(The `@ts-expect-error` on async server components matches how `UpcomingBattles` — itself `async` — is consumed here today; if the project's Next/TS version renders these without the directive, drop the comments. Verify with `cd apps/web && npx tsc --noEmit` in Step 5.)

- [ ] **Step 3: Mount the mini-card on the tournaments page**

Replace `apps/web/src/app/tournaments/page.tsx` `default export` with (keep `fetchInitialTournaments` as-is):

```tsx
export default async function TournamentsPage() {
  const initialData = await fetchInitialTournaments();
  const featured = await fetchFeaturedArmfight();
  return (
    <>
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <MainArmfightMiniCard tournament={featured} />
      </div>
      <TournamentsPageClient initialData={initialData} />
    </>
  );
}
```

Add imports at the top of that file:

```ts
import { fetchFeaturedArmfight } from '@/lib/api-server';
import { MainArmfightMiniCard } from '@/components/armfight/MainArmfightMiniCard';
```

- [ ] **Step 4: Mount the hero on the home page**

In `apps/web/src/app/page.tsx`, add the import after line 7:

```ts
import { MainArmfightHeroClient } from '@/components/armfight/MainArmfightHeroClient';
```

Then render it directly **after** the closing `</section>` of the existing hero (line 131), before the Sports section:

```tsx
      <MainArmfightHeroClient />
```

- [ ] **Step 5: Typecheck + build smoke**

Run: `cd apps/web && npx tsc --noEmit && npx next build --no-lint 2>&1 | tail -20`
Expected: typecheck clean; build completes (the three pages compile).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/armfight/UpcomingArmfights.tsx apps/web/src/app/sport/'[sport]'/page.tsx apps/web/src/app/tournaments/page.tsx apps/web/src/app/page.tsx
git commit -m "feat(web): mount armfight hero/list on home, sport, tournaments"
```

---

## Task 10: i18n namespace + admin wizard fields + final gate

**Files:**
- Modify: `apps/web/src/messages/ru.json`, `apps/web/src/messages/en.json`, `apps/web/src/messages/hy.json`
- Modify: `apps/web/src/components/admin/tournament-wizard/TournamentWizard.tsx`

- [ ] **Step 1: Add the `armfight` namespace to all three message files**

Append a top-level `"armfight"` key to each file (match the existing JSON indentation; values below are RU — translate for EN/HY accordingly):

`ru.json`:
```json
"armfight": {
  "main_event": "Главное событие",
  "starts_in": "стартует через",
  "days": "ДНИ",
  "hours": "ЧАСЫ",
  "minutes": "МИН",
  "seconds": "СЕК",
  "live": "Идёт сейчас",
  "cta_bracket": "Участники и сетка",
  "cta_details": "Подробнее о событии",
  "watch_video": "Видео / YouTube",
  "upcoming_title": "Ближайшие армфайты",
  "none_soon": "Скоро объявим"
}
```
`en.json`: same keys — `"Main event" / "starts in" / "DAYS" / "HOURS" / "MIN" / "SEC" / "Live now" / "Participants & bracket" / "Event details" / "Video / YouTube" / "Upcoming armfights" / "Announced soon"`.
`hy.json`: same keys — `"Գլխավոր իրադարձություն" / "մեկնարկում է" / "ՕՐ" / "ԺԱՄ" / "ՐՈՊԵ" / "ՎՐԿ" / "Ընթացքի մեջ է" / "Մասնակիցներ և ցանց" / "Իրադարձության մասին" / "Տեսանյութ / YouTube" / "Մոտակա արմֆայթներ" / "Շուտով"`.

- [ ] **Step 2: Verify i18n keys load (no missing-message errors)**

Run: `cd apps/web && npx vitest run src/components/armfight`
Expected: still PASS (specs mock `next-intl`, so this is a JSON-validity check); also run `node -e "require('./src/messages/ru.json');require('./src/messages/en.json');require('./src/messages/hy.json')"` → no parse error.

- [ ] **Step 3: Add the wizard "main event" toggle + video link field**

Inspect `apps/web/src/components/admin/tournament-wizard/TournamentWizard.tsx` to find the form-state object and the registration/review step. Add two controlled fields wired into the submit payload:
- `isFeatured: boolean` → checkbox "Главное событие (армфайт)" (only render this control when the wizard's `competitionType === 'armfight'`).
- `armfightVideoUrl: string` → text input "Ссылка на видео / YouTube".

Both keys must be included in the object POSTed/PATCHed to the admin tournaments endpoint (the admin `CreateTournamentDto` now accepts both — Task 2). Concretely: locate the payload object built before the `api.post`/`api.patch` call in this file (or in `_lib/` if extracted) and add `isFeatured` and `armfightVideoUrl` to it, defaulting `armfightVideoUrl` to `undefined` when the input is empty (so `@IsUrl` is not triggered on empty string).

- [ ] **Step 4: Wizard typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Full gate — lint + all tests**

Run: `npx turbo lint && npx turbo test`
Expected: lint clean; all suites pass (api + web + bracket-engine unaffected).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/messages/ru.json apps/web/src/messages/en.json apps/web/src/messages/hy.json apps/web/src/components/admin/tournament-wizard/TournamentWizard.tsx
git commit -m "feat(web,i18n): armfight namespace + admin main-event toggle & video link"
```

---

## Self-Review

**Spec coverage:**
- Spec §3 data model → Task 1 (`armfightVideoUrl`); reconciliation note explains `isFeatured`/`posterUrl`/`streamUrl` reuse. ✓
- Spec §4 API (list filter + featured endpoint, 200/204) → Tasks 3, 4. ✓
- Spec §5 frontend (Countdown/hero/mini/list, SSR + React Query, `armfight` i18n) → Tasks 5–10. ✓
- Spec §6 lifecycle (upcoming/live/finished-hidden, no-featured → null) → Task 3 (`status NOT IN terminal`), Task 8 (hero returns null on completed/cancelled; mini-card video-only when finished+url). ✓
- Spec §7 content + conditional badge/city, CTA defaults → Task 8 (`weightTitle`/`city` conditional with tests). ✓
- Spec §8 admin (toggle + video; must work post-bracket) → Task 2 (promo-scalar exception) + Task 10 (wizard fields). ✓
- Spec §9 testing → every task is TDD with `getRepositoryToken` (api) / RTL (web). ✓
- Spec §10 conventions → generated migration (Task 1), service-layer logic (Tasks 2-3), thin controller (Task 4), `next-intl` namespace (Task 10), conventional commits throughout. ✓
- Spec §11 decomposition → B not present in this plan. ✓

**Placeholder scan:** No "TBD/TODO". Task 10 Step 3 describes the wizard wiring in prose (not full code) because the wizard's form-state shape must be read at implementation time — but it names the exact file, exact keys, exact payload location, and the empty-string→undefined rule. Acceptable: it is a precise instruction, not a vague one.

**Type consistency:** `CountdownParts` (Task 6) consumed by `Countdown` (Task 7). `isArmfightTournament` (Task 5) consumed by `UpcomingArmfights` (Task 9). `fetchFeaturedArmfight` (Task 5) consumed by Tasks 8, 9. `useFeaturedArmfight`/`useUpcomingArmfights` (Task 5) consumed by Task 8. `findFeaturedArmfight` (Task 3) consumed by Task 4. `armfightVideoUrl` consistent across entity (T1), DTO (T2), type (T5), components (T8). Names verified consistent.

**Spec drift to surface to the user:** the plan reuses `isFeatured` (no new featured column) and adds only `armfightVideoUrl` — leaner than spec §3. The spec doc should be updated to match, or the deviation accepted as-is.

---

## Execution Handoff

See the chat message accompanying this plan for the two execution options.
