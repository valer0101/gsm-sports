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
   * Optional override target. If set, the prize applies only to that age
   * group's brackets. If unset, the prize is part of the "default" pool
   * that applies to any age group lacking its own overrides.
   */
  ageGroup?: AgeGroup;
};

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
