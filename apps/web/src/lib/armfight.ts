import type { Tournament } from '@/types/api';

/** Single source of truth for "is this an armfight event". Defensive: the
 *  wizard may persist the choice as `format` or in `sportConfig`. */
export function isArmfightTournament(t: Tournament | null | undefined): boolean {
  if (!t) return false;
  if (t.format === 'armfight') return true;
  const ct = t.sportConfig?.competitionType;
  return ct === 'armfight';
}
