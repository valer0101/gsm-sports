import type { AgeGroup, PrizeType } from './types';

export const FORMATS = [
  { id: 'single_elimination', label: 'Single elim', desc: 'One loss = out' },
  { id: 'double_elimination', label: 'Double elim', desc: 'Loser bracket gives 2nd chance', recommended: true },
  { id: 'round_robin', label: 'Round robin', desc: 'Everyone plays everyone' },
] as const;

export const STEPS = [
  { num: 1, label: 'BASIC' },
  { num: 2, label: 'FORMAT' },
  { num: 3, label: 'CATEGORIES' },
  { num: 4, label: 'REGISTRATION' },
] as const;

export const AGE_GROUPS: { id: AgeGroup; label: string; sub: string }[] = [
  { id: 'juniors', label: 'Juniors', sub: 'under 18' },
  { id: 'adults', label: 'Adults', sub: '18 – 39' },
  { id: 'veterans', label: 'Veterans', sub: '40 +' },
];

export const PRESET_WEIGHTS = [50, 60, 65, 70, 75, 80, 85, 90, 100, 110];

// PRIZE_TYPES is defined inside PrizeRow to keep icon imports localized.
export const PRIZE_TYPE_LABELS: Record<PrizeType, string> = {
  money: 'Money',
  medal: 'Medal',
  trophy: 'Trophy',
  certificate: 'Certificate',
  custom: 'Custom',
};
