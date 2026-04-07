'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Tournament } from '@/types/api';
import { ParticipantsList } from '@/components/tournaments/ParticipantsList';
import { BracketView } from '@/components/tournaments/BracketView';
import { RegisterModal } from '@/components/tournaments/RegisterModal';

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

  const canRegister = tournament.registrationOpen;
  const hasBracket = tournament.bracketGenerated;

  function handleRegisterClick() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('gsm_access_token') : null;
    if (!token) {
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
