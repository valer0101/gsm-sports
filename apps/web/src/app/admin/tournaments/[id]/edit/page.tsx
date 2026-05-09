'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAdminTournament, useUpdateTournament } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/Skeleton';
import { TournamentWizard } from '@/components/admin/tournament-wizard/TournamentWizard';
import { tournamentToWizardData } from '@/components/admin/tournament-wizard/_lib/tournament-to-wizard-data';

export default function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('admin_tournament');
  const router = useRouter();
  const { data: tournament, isLoading } = useAdminTournament(id);
  const updateMutation = useUpdateTournament(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)] px-4 py-10">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)] px-4 py-10 text-center">
        {t('not_found')}{' '}
        <Link href="/admin" className="underline">
          {t('back')}
        </Link>
      </div>
    );
  }

  // Backend (apps/api/src/admin/admin.service.ts:120) refuses any edit once
  // the bracket is generated — fail closed in the UI rather than letting the
  // admin fill the form only to hit a server 400 on submit.
  if (tournament.bracketGenerated) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)] px-4 py-10">
        <div className="max-w-xl mx-auto rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-6">
          <h1 className="text-lg font-bold text-[var(--color-warning)] mb-2">
            {t('edit_blocked_title')}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            {t('edit_blocked_body')}
          </p>
          <Link
            href={`/admin/tournaments/${id}`}
            className="inline-block px-4 py-2 rounded-md text-sm bg-[var(--color-surface-2)] hover:bg-[var(--color-border-strong)] text-white transition-colors"
          >
            ← {t('edit_back_to_detail')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TournamentWizard
      mode="edit"
      initialData={tournamentToWizardData(tournament)}
      isSubmitting={updateMutation.isPending}
      onCancel={() => router.push(`/admin/tournaments/${id}`)}
      onSubmit={async (payload) => {
        await updateMutation.mutateAsync(payload as never);
        router.push(`/admin/tournaments/${id}`);
      }}
    />
  );
}
