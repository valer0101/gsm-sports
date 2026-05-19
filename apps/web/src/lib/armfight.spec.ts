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
