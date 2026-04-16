'use client';

import { useRouter } from 'next/navigation';
import { useCreateAthlete } from '@/hooks/useAthletes';
import { AthleteForm } from '../_AthleteForm';

export default function NewAthletePage() {
  const router = useRouter();
  const createMutation = useCreateAthlete();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Новый спортсмен</h1>
      </div>
      <AthleteForm
        onSubmit={(data) =>
          createMutation.mutate(data, { onSuccess: () => router.push('/admin/athletes') })
        }
        isPending={createMutation.isPending}
        isError={createMutation.isError}
        error={createMutation.error}
      />
    </div>
  );
}
