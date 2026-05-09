/**
 * Maps the API `Tournament` shape (returned by `useAdminTournament(id)`) into
 * the partial-state seed the wizard accepts via `initialData`.
 *
 * Tricky bit: the API stores one `WeightCategory` row per (category × gender)
 * — e.g. a single "до 70 кг" with both male/female becomes two DB rows. The
 * wizard models categories as one entry per (name, minWeight, maxWeight) and
 * the gender list as a tournament-wide Set. This mapper de-duplicates the
 * rows back into that shape and unions the genders.
 */

import type { Tournament, WeightCategory as ApiWeightCategory } from '@/types/api';
import type { TournamentWizardInitialData } from '../TournamentWizard';
import type { AgeGroup, CompetitionType, EntryFeeType, Gender, Hand, Prize, WeightCat } from './types';
import { newCatId, newPrizeId } from './types';

type SportConfigShape = {
  competitionType?: CompetitionType;
  hands?: string[];
  ageGroups?: AgeGroup[];
  format?: string;
  maxParticipantsPerCategory?: number | string;
  matchDurationSec?: number | string;
  tiebreaker?: string;
  weighInRequired?: boolean;
  defaultBracketFormat?: string;
  prizes?: Array<{
    place: number;
    type: Prize['type'];
    amount?: string | number;
    description?: string;
    ageGroup?: AgeGroup;
    weightCategoryId?: string;
  }>;
  entryFee?: {
    type?: EntryFeeType;
    amount?: number | string | null;
    description?: string | null;
  };
};

function mapHands(hands: string[] | undefined): Hand {
  if (!hands || hands.length === 0) return '';
  if (hands.length >= 2) return 'both';
  if (hands[0] === 'left') return 'left';
  if (hands[0] === 'right') return 'right';
  return '';
}

/**
 * Group the per-(category × gender) rows back into one client `WeightCat`
 * per (name, minWeight, maxWeight). Genders are unioned into a Set; the
 * tournament-wide tolerance is taken from the first row (the API stores
 * the same value on every row in a category — see `WeightCategoryInput`).
 */
function dedupeWeightCategories(rows: ApiWeightCategory[]): {
  categories: WeightCat[];
  genders: Set<Gender>;
  tolerance: number;
} {
  const byKey = new Map<string, WeightCat>();
  const genders = new Set<Gender>();
  let tolerance = 0;

  for (const row of rows) {
    // TypeORM returns Postgres `decimal` columns as strings even though
    // the type definition declares `number | null`. Coerce eagerly so the
    // wizard's `WeightCat` always carries real numbers (Step 3 calls
    // `.toFixed()` directly on these).
    const minKg = row.minWeight !== null && row.minWeight !== undefined ? Number(row.minWeight) : null;
    const maxKg = row.maxWeight !== null && row.maxWeight !== undefined ? Number(row.maxWeight) : null;
    const key = `${row.name}|${minKg ?? ''}|${maxKg ?? ''}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: newCatId(),
        minKg,
        maxKg,
        name: row.name,
      });
    }
    if (row.gender === 'male' || row.gender === 'female') {
      genders.add(row.gender);
    }
    const rowTol = row.weightToleranceKg != null ? Number(row.weightToleranceKg) : 0;
    if (rowTol > tolerance) {
      tolerance = rowTol;
    }
  }

  return {
    categories: Array.from(byKey.values()),
    genders: genders.size > 0 ? genders : new Set<Gender>(['male', 'female']),
    tolerance,
  };
}

function mapPrizes(rows: SportConfigShape['prizes']): Prize[] {
  if (!rows) return [];
  return rows.map((p) => ({
    id: newPrizeId(),
    place: p.place,
    type: p.type,
    amount: p.amount != null ? String(p.amount) : undefined,
    description: p.description,
    ageGroup: p.ageGroup,
    weightCategoryId: p.weightCategoryId,
  }));
}

/**
 * Build the wizard's `initialData` from a fully populated `Tournament`. The
 * `slug` is included so the wizard treats the form as having a manual slug
 * and won't overwrite it from a name change.
 */
export function tournamentToWizardData(t: Tournament): TournamentWizardInitialData {
  const sc = (t.sportConfig ?? {}) as SportConfigShape;
  const { categories, genders, tolerance } = dedupeWeightCategories(t.weightCategories ?? []);

  const startDate = t.startDate ? toLocalInput(t.startDate) : '';
  const endDate = t.endDate ? toLocalInput(t.endDate) : '';
  const registrationDeadline = t.registrationDeadline ? toLocalInput(t.registrationDeadline) : '';

  return {
    name: t.name,
    slug: t.slug,
    sportId: t.sport?.id ?? '',
    format: sc.format ?? t.format ?? 'double_elimination',
    startDate,
    endDate,
    country: t.country ?? '',
    city: t.city ?? '',
    venue: t.location ?? '',
    description: {
      ru: t.descriptionRu ?? '',
      en: t.descriptionEn ?? '',
      hy: t.descriptionHy ?? '',
    },
    posterUrl: t.posterUrl,
    competitionType: sc.competitionType ?? 'setka',
    ageGroups: sc.ageGroups ?? [],
    hand: mapHands(sc.hands),
    maxParticipantsPerCategory: sc.maxParticipantsPerCategory != null ? String(sc.maxParticipantsPerCategory) : '',
    matchDurationSec: sc.matchDurationSec != null ? String(sc.matchDurationSec) : '',
    tiebreaker: sc.tiebreaker ?? 'higher_seed',
    categories,
    weightToleranceKg: tolerance,
    genders: Array.from(genders),
    registrationDeadline,
    // In edit mode the registration toggle is irrelevant — registration is
    // managed from the detail page. Default to false so save doesn't trip
    // any "open immediately" side-effect even if the wizard exposed it.
    registrationOpenImmediately: false,
    entryFeeType: sc.entryFee?.type ?? 'free',
    entryFeeAmount: sc.entryFee?.amount != null ? String(sc.entryFee.amount) : '',
    entryFeeConditions: sc.entryFee?.description ?? '',
    prizes: mapPrizes(sc.prizes),
    streamUrl: t.streamUrl ?? '',
    isFeatured: t.isFeatured,
    maxParticipants: t.maxParticipants != null ? String(t.maxParticipants) : '',
  };
}

/**
 * Converts an ISO timestamp from the API into the `YYYY-MM-DDTHH:mm` format
 * required by `<input type="datetime-local">` (no timezone, no seconds).
 * Uses the browser's local zone to match what the user sees.
 */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
