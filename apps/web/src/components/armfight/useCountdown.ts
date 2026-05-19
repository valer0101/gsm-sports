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
