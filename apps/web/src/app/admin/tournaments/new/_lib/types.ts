export type AgeGroup = 'juniors' | 'adults' | 'veterans';

export type Hand = 'right' | 'left' | 'both' | '';

export type CompetitionType = 'setka' | 'armfight' | '';

export type Gender = 'male' | 'female';

export type WeightCat = {
  id: string;
  minKg: number | null;
  maxKg: number | null;
  name?: string;
  genders?: Gender[];
};

export type PrizeType = 'money' | 'medal' | 'trophy' | 'certificate' | 'custom';

export type Prize = {
  id: string;
  place: number;
  type: PrizeType;
  amount?: string;
  description?: string;
  /**
   * Optional age-group override. If set, the prize applies only to that
   * group's brackets. Together with `weightCategoryId`, the (age, category)
   * pair forms the override scope; the most specific match wins.
   */
  ageGroup?: AgeGroup;
  /**
   * Optional weight-category override (client-side category id). If set,
   * the prize applies only to that category's brackets. Falls back to the
   * "all categories" entry when missing.
   */
  weightCategoryId?: string;
};

export function categoryLabel(c: WeightCat): string {
  if (c.name) return c.name;
  if (c.minKg === null && c.maxKg === null) return 'Absolute';
  if (c.maxKg === null) return `${c.minKg}+ kg`;
  return `${c.maxKg} kg`;
}

export type Locale = 'ru' | 'en' | 'hy';

export type EntryFeeType = 'free' | 'paid';

export type ReviewData = {
  name: string;
  poster: string | null;
  sportName: string;
  sportEmoji: string;
  competitionType: CompetitionType;
  format: string;
  startDate: string;
  endDate: string;
  country: string;
  city: string;
  venue: string;
  ageGroupCount: number;
  hand: Hand;
  categoryCount: number;
};

let _catIdSeq = 1;
export const newCatId = () => `c${_catIdSeq++}`;

let _prizeIdSeq = 1;
export const newPrizeId = () => `p${_prizeIdSeq++}`;
