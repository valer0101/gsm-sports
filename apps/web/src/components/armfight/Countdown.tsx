'use client';
import { useTranslations } from 'next-intl';
import { useCountdown } from './useCountdown';

function Box({ value, label, testid, hot }: {
  value: string; label: string; testid: string; hot?: boolean;
}) {
  return (
    <div
      data-testid={testid}
      className="rounded-lg px-4 py-3 min-w-[72px] text-center"
      style={{
        background: hot ? 'rgba(200,16,46,0.12)' : 'rgba(15,15,26,0.45)',
        border: `1px solid ${hot ? 'var(--color-primary)' : 'rgba(255,255,255,0.35)'}`,
      }}
    >
      <div className="text-3xl font-black text-white leading-none">{value}</div>
      <div
        className="text-[10px] tracking-widest mt-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </div>
    </div>
  );
}

export function Countdown({ targetIso }: { targetIso: string }) {
  const t = useTranslations('armfight');
  const c = useCountdown(targetIso);

  if (c.ended) {
    return (
      <span
        data-testid="cd-live"
        className="inline-block text-sm font-black uppercase tracking-widest px-4 py-2 rounded-full animate-pulse"
        style={{ background: 'var(--color-primary)', color: '#fff' }}
      >
        {t('live')}
      </span>
    );
  }

  return (
    <div className="flex gap-3" data-testid="cd-root">
      <Box testid="cd-days" value={c.dd} label={t('days')} />
      <Box testid="cd-hours" value={c.hh} label={t('hours')} />
      <Box testid="cd-mins" value={c.mm} label={t('minutes')} />
      <Box testid="cd-secs" value={c.ss} label={t('seconds')} hot />
    </div>
  );
}
