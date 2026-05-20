import { getTranslations } from 'next-intl/server';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { fetchUpcomingArmfights } from '@/lib/api-server';

export async function UpcomingArmfights() {
  const items = await fetchUpcomingArmfights();
  const t = await getTranslations('armfight');
  return (
    <section className="px-4 py-14">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-black uppercase tracking-wide text-white mb-8">
          {t('upcoming_title')}
        </h2>
        {items.length === 0 ? (
          <p
            className="py-12 text-center border-t border-white/10"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('none_soon')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((x) => (
              <TournamentCard key={x.id} tournament={x} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
