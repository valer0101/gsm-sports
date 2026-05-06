'use client';

import type { Sport } from '@/types/api';

// `useSports` lives in `@/hooks/useAthletes` (same query key, same endpoint —
// React Query dedupes). Re-export it from here so wizard files don't need to
// know about the indirection, and we don't ship a third implementation.
export { useSports } from '@/hooks/useAthletes';

export function pickSportName(s: Sport | undefined): string {
  if (!s) return '';
  return s.nameRu || s.nameEn || s.nameHy || s.slug;
}

export function pickSportEmoji(slug: string | undefined): string {
  // Existing project has no per-sport emoji on the entity; pick a sensible
  // default by slug. Falls back to a generic icon for unknown sports.
  switch (slug) {
    case 'armwrestling': return '💪';
    case 'mma': return '🥋';
    case 'boxing': return '🥊';
    case 'wrestling': return '🤼';
    case 'kickboxing': return '🦵';
    default: return '🏆';
  }
}
