import type { BracketFormat, SportConfig } from '@gsm/shared-types';

/**
 * Runtime presets + resolver for SportConfig.
 *
 * Lives under apps/api (not @gsm/shared-types) because packages/shared-types
 * is — per CLAUDE.md — "TypeScript types shared between apps". Presets and
 * the resolver are runtime code, not types.
 *
 * The frontend never needs the presets directly: the API always returns a
 * fully-resolved config on every Sport response (see SportsService.findAll
 * / findBySlug / findById), so apps/web only imports the `SportConfig` *type*
 * from shared-types.
 */

/** Safe defaults — used when a sport doesn't have config set yet. */
export const SPORT_CONFIG_DEFAULTS: SportConfig = {
  categoriesType: 'none',
  hasHands: false,
  bracketFormats: ['single_elim', 'double_elim'],
  defaultBracketFormat: 'single_elim',
  matchResultSchema: 'simple_winner',
  weighInRequired: false,
};

type LocalizedPair = {
  singular: { ru: string; en: string; hy: string };
  plural: { ru: string; en: string; hy: string };
};

type SportPreset = Partial<Omit<SportConfig, 'surfaceTerm' | 'participantTerm'>> & {
  surfaceTerm?: LocalizedPair;
  participantTerm?: LocalizedPair;
};

/**
 * Per-slug baseline configs used to seed/backfill existing sports.
 *
 * `surfaceTerm` and `participantTerm` are stored as localised triples so the
 * UI can render the right word per locale ("table / стол / սեղան" for
 * armwrestling, "ring / ринг / ռինգ" for boxing). The frontend picks the
 * current locale; the raw stored blob always holds all three.
 */
export const SPORT_CONFIG_PRESETS: Record<string, SportPreset> = {
  armwrestling: {
    categoriesType: 'weight',
    hasHands: true,
    bracketFormats: ['double_elim', 'single_elim'],
    defaultBracketFormat: 'double_elim',
    matchResultSchema: 'armwrestling',
    weighInRequired: true,
    surfaceTerm: {
      singular: { ru: 'стол', en: 'table', hy: 'սեղան' },
      plural: { ru: 'столы', en: 'tables', hy: 'սեղաններ' },
    },
  },
  boxing: {
    categoriesType: 'weight',
    bracketFormats: ['single_elim', 'double_elim'],
    defaultBracketFormat: 'single_elim',
    matchResultSchema: 'points',
    weighInRequired: true,
    surfaceTerm: {
      singular: { ru: 'ринг', en: 'ring', hy: 'ռինգ' },
      plural: { ru: 'ринги', en: 'rings', hy: 'ռինգներ' },
    },
  },
  mma: {
    categoriesType: 'weight',
    bracketFormats: ['single_elim'],
    defaultBracketFormat: 'single_elim',
    matchResultSchema: 'points',
    weighInRequired: true,
    surfaceTerm: {
      singular: { ru: 'клетка', en: 'cage', hy: 'վանդակ' },
      plural: { ru: 'клетки', en: 'cages', hy: 'վանդակներ' },
    },
  },
  jiu_jitsu: {
    categoriesType: 'weight',
    bracketFormats: ['single_elim', 'double_elim'],
    defaultBracketFormat: 'double_elim',
    matchResultSchema: 'points',
    weighInRequired: true,
  },
  chess: {
    categoriesType: 'skill',
    bracketFormats: ['swiss', 'round_robin', 'single_elim'],
    defaultBracketFormat: 'swiss',
    matchResultSchema: 'simple_winner',
    weighInRequired: false,
  },
};

/**
 * Merge raw stored config with preset + defaults. Always returns a fully-
 * populated SportConfig so consumers (API callers, frontend) don't need
 * null-checks.
 */
export function resolveSportConfig(
  slug: string,
  raw: Partial<SportConfig> | null | undefined,
): SportConfig {
  const preset = (SPORT_CONFIG_PRESETS[slug] ?? {}) as Partial<SportConfig>;
  return { ...SPORT_CONFIG_DEFAULTS, ...preset, ...(raw ?? {}) };
}

/**
 * Validate that `format` is one of the bracket formats allowed for this sport.
 * Used by bracket generation to fail loudly if an organizer picks something
 * the sport config doesn't list (or if nothing is picked, fall back to the
 * sport's default).
 */
export function isFormatAllowed(cfg: SportConfig, format: BracketFormat): boolean {
  return cfg.bracketFormats.includes(format);
}
