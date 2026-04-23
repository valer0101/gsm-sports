'use client';

import { useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { useAdminCheckInByQr } from '@/hooks/useAdmin';
import type { TournamentEntry } from '@/types/api';

interface ScanOutcome {
  ok: boolean;
  entry?: TournamentEntry;
  error?: string;
}

export default function AdminCheckInScannerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = use(params);
  const t = useTranslations('admin_checkin_scan');
  const checkIn = useAdminCheckInByQr(tournamentId);

  const [lastOutcome, setLastOutcome] = useState<ScanOutcome | null>(null);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  // `paused` gates the camera from reading while a mutation is in flight
  // or while the last result banner is on screen — without this, rapid
  // scans queue up before the user has had a chance to confirm the
  // outcome visually.
  const [paused, setPaused] = useState(false);
  // Dedupe the most recent token for a short window — BarcodeDetector
  // repeatedly emits the same QR every frame while it's in view.
  const [lastTokenAt, setLastTokenAt] = useState<{ token: string; at: number } | null>(null);

  const handleScan = useCallback(
    (codes: IDetectedBarcode[]) => {
      if (paused || codes.length === 0) return;
      const token = codes[0].rawValue;
      if (!token) return;
      const now = Date.now();
      if (lastTokenAt && lastTokenAt.token === token && now - lastTokenAt.at < 3000) {
        return;
      }
      setLastTokenAt({ token, at: now });
      setPaused(true);
      checkIn.mutate(token, {
        onSuccess: (entry) => {
          setLastOutcome({ ok: true, entry });
          setCheckedInCount((n) => n + 1);
        },
        onError: (err) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            t('unknown_error');
          setLastOutcome({ ok: false, error: msg });
          setErrorCount((n) => n + 1);
        },
        // Resume scanning after a short visual pause so operators can
        // confirm the outcome. 2s works on a phone; tweak if too fast.
        onSettled: () => {
          window.setTimeout(() => {
            setLastOutcome(null);
            setPaused(false);
          }, 2000);
        },
      });
    },
    [paused, lastTokenAt, checkIn, t],
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href={`/admin/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-2 text-sm mb-4 hover:text-white transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        ← {t('back')}
      </Link>

      <h1 className="text-2xl font-black text-white mb-1">{t('title')}</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
        {t('subtitle')}
      </p>

      <div className="flex gap-2 mb-5">
        <Stat
          label={t('stat_checked_in')}
          value={checkedInCount}
          color="#10b981"
        />
        <Stat label={t('stat_errors')} value={errorCount} color="#ef4444" />
      </div>

      {/* Camera view — library handles getUserMedia + BarcodeDetector */}
      <div
        className="rounded-2xl overflow-hidden border border-white/10 mb-4"
        style={{ backgroundColor: 'black', aspectRatio: '1 / 1' }}
      >
        <Scanner
          onScan={handleScan}
          onError={(err) => {
            // Don't explode the page on a permission denial — surface it in
            // the result banner so the user can retry.
            setLastOutcome({
              ok: false,
              error: (err as Error)?.message ?? t('camera_error'),
            });
          }}
          formats={['qr_code']}
          paused={paused}
          scanDelay={300}
          components={{ finder: true }}
        />
      </div>

      {/* Last-scan result banner */}
      {lastOutcome && (
        <div
          className="rounded-2xl p-4 border text-center"
          style={{
            borderColor: lastOutcome.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
            backgroundColor: lastOutcome.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          }}
        >
          {lastOutcome.ok ? (
            <>
              <p className="text-4xl mb-1">✓</p>
              <p className="text-white font-bold">
                {lastOutcome.entry?.user
                  ? `${lastOutcome.entry.user.firstName} ${lastOutcome.entry.user.lastName}`.trim()
                  : t('checked_in_generic')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                {[lastOutcome.entry?.ageGroup, lastOutcome.entry?.hand]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </>
          ) : (
            <>
              <p className="text-4xl mb-1">✗</p>
              <p className="font-bold text-red-300">{lastOutcome.error}</p>
            </>
          )}
        </div>
      )}

      {!lastOutcome && !paused && (
        <p
          className="text-center text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {t('point_camera_hint')}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex-1 rounded-xl px-4 py-3 border border-white/10"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <p
        className="text-xs uppercase tracking-wider mb-0.5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </p>
      <p className="text-2xl font-black" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
