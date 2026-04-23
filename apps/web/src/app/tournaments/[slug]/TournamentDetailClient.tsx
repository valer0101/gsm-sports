'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';
import type { Tournament, TournamentEntry } from '@/types/api';
import { ParticipantsList } from '@/components/tournaments/ParticipantsList';
import { BracketView } from '@/components/tournaments/BracketView';
import { RegisterModal } from '@/components/tournaments/RegisterModal';
import { useMyEntries, useCheckinQr } from '@/hooks/useEntries';

type Tab = 'participants' | 'bracket';

interface Props {
  tournament: Tournament;
}

export function TournamentDetailClient({ tournament }: Props) {
  const t = useTranslations('tournaments');
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('participants');
  const [showModal, setShowModal] = useState(false);
  const [registered, setRegistered] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
    retry: false,
  });

  const canRegister = tournament.registrationOpen;
  const hasBracket = tournament.bracketGenerated;

  function handleRegisterClick() {
    if (!currentUser) {
      router.push(`/auth/login?redirect=/tournaments/${tournament.slug}`);
      return;
    }
    setShowModal(true);
  }

  return (
    <div>
      {/* Register button */}
      {canRegister && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleRegisterClick}
            className="px-5 py-2.5 rounded-xl font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
          >
            {registered ? t('registered') : t('register_btn')}
          </button>
        </div>
      )}

      {/* Athlete's own registration(s) for this tournament — shows the
          check-in QR before the event, a "checked in" badge once they're
          on site, or nothing for anonymous / unregistered visitors. */}
      {currentUser && <MyRegistrationSection tournamentId={tournament.id} />}

      {/* Tabs */}
      <div
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <div className="flex border-b border-white/10">
          <TabButton
            active={tab === 'participants'}
            onClick={() => setTab('participants')}
            label={t('tab_participants')}
          />
          <TabButton
            active={tab === 'bracket'}
            onClick={() => setTab('bracket')}
            label={t('tab_bracket')}
            badge={!hasBracket ? t('bracket_pending_badge') : undefined}
          />
        </div>

        <div className="p-6">
          {tab === 'participants' && <ParticipantsList tournamentId={tournament.id} />}
          {tab === 'bracket' &&
            (hasBracket ? (
              <BracketView tournamentId={tournament.id} />
            ) : (
              <p className="text-center py-10" style={{ color: 'var(--color-text-secondary)' }}>
                {t('bracket_not_ready')}
              </p>
            ))}
        </div>
      </div>

      {/* Weight categories (if any) */}
      {tournament.weightCategories?.length > 0 && (
        <div
          className="rounded-xl border border-white/10 p-6 mt-6"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <h2 className="font-bold text-white mb-4">{t('weight_categories')}</h2>
          <div className="flex flex-wrap gap-2">
            {tournament.weightCategories.map((wc) => (
              <span
                key={wc.id}
                className="px-3 py-1.5 rounded-full text-sm border border-white/15"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {wc.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <RegisterModal
          tournament={tournament}
          onClose={() => setShowModal(false)}
          onSuccess={() => setRegistered(true)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative"
      style={{
        color: active ? 'white' : 'var(--color-text-secondary)',
        borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
      }}
    >
      {label}
      {badge && (
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function MyRegistrationSection({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations('tournaments');
  const { data: myEntries, isLoading } = useMyEntries();

  // Filter to THIS tournament. Athletes can register multiple times in
  // the same tournament when a sport has multiple hands/categories (e.g.
  // armwrestling left + right), so render one card per entry.
  const mine = (myEntries ?? []).filter((e) => e.tournamentId === tournamentId);

  if (isLoading || mine.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {mine.map((entry) => (
        <MyRegistrationCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function MyRegistrationCard({ entry }: { entry: TournamentEntry }) {
  const t = useTranslations('tournaments');
  const isCheckedIn = entry.status === 'checked_in';
  // Only fetch a QR when one will actually be shown — saves a round trip
  // for already-checked-in / withdrawn / rejected entries.
  const qrNeeded = !isCheckedIn && entry.status !== 'withdrawn' && entry.status !== 'rejected';
  const { data: qr } = useCheckinQr(qrNeeded ? entry.id : null);

  const statusLabel =
    isCheckedIn ? t('checkin_status_checked_in')
    : entry.status === 'confirmed' ? t('checkin_status_confirmed')
    : entry.status === 'pending' ? t('checkin_status_pending')
    : entry.status === 'withdrawn' ? t('checkin_status_withdrawn')
    : t('checkin_status_rejected');

  const statusColor =
    isCheckedIn ? '#10b981'
    : entry.status === 'confirmed' ? 'var(--color-accent)'
    : entry.status === 'pending' ? '#fbbf24'
    : '#9ca3af';

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col sm:flex-row items-start gap-5"
      style={{
        backgroundColor: 'var(--color-secondary)',
        borderColor: isCheckedIn ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)',
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-xs uppercase tracking-wider mb-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {t('my_registration_label')}
        </p>
        <p className="text-lg font-black text-white mb-2">
          {[entry.ageGroup, entry.hand, entry.weightKg ? `${entry.weightKg} kg` : null]
            .filter(Boolean)
            .join(' · ') || t('my_registration_entry_fallback')}
        </p>
        <span
          className="inline-block px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ color: statusColor, backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          {statusLabel}
        </span>

        {qrNeeded && (
          <p className="text-xs mt-3" style={{ color: 'var(--color-text-secondary)' }}>
            {t('checkin_qr_hint')}
          </p>
        )}
      </div>

      {qrNeeded && qr?.token && (
        <div className="shrink-0 rounded-xl bg-white p-3">
          {/* White background required — QR needs strong contrast for a
              phone camera to lock on even in venue lighting. */}
          <QRCodeSVG value={qr.token} size={140} level="M" />
        </div>
      )}

      {isCheckedIn && (
        <div
          className="shrink-0 text-center text-5xl"
          style={{ color: '#10b981' }}
        >
          ✓
        </div>
      )}
    </div>
  );
}
