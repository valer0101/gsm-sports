'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAthlete, useUpdateAthlete } from '@/hooks/useAthletes';
import { AthleteForm } from '../_AthleteForm';
import { Skeleton } from '@/components/ui/Skeleton';

export default function EditAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: athlete, isLoading } = useAthlete(id);
  const updateMutation = useUpdateAthlete(id);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">
          {athlete ? `${athlete.firstName} ${athlete.lastName}` : 'Редактировать спортсмена'}
        </h1>
        {athlete?.slug && (
          <p className="text-xs mt-1 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
            /athletes/{athlete.slug}
          </p>
        )}
      </div>
      <AthleteForm
        initial={athlete}
        onSubmit={(data) =>
          updateMutation.mutate(data, { onSuccess: () => router.push('/admin/athletes') })
        }
        isPending={updateMutation.isPending}
        isError={updateMutation.isError}
        error={updateMutation.error}
      />
    </div>
  );
}
