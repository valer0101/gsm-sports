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
