'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCreateTournament } from '@/hooks/useAdmin';
import { TournamentWizard } from '@/components/admin/tournament-wizard/TournamentWizard';

export default function NewTournamentPage() {
  const router = useRouter();
  const createMutation = useCreateTournament();

  return (
    <TournamentWizard
      mode="create"
      isSubmitting={createMutation.isPending}
      onCancel={() => router.push('/admin')}
      onSubmit={async (payload, { registrationOpenImmediately }) => {
        const created = await createMutation.mutateAsync(payload as never);
        if (registrationOpenImmediately && created?.id) {
          try {
            await api.patch(`/admin/tournaments/${created.id}/toggle-registration`);
          } catch {
            // Non-fatal — tournament was created.
          }
        }
        router.push(created?.id ? `/admin/tournaments/${created.id}` : '/admin');
      }}
    />
  );
}
