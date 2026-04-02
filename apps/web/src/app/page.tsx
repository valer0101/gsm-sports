import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold" style={{ color: 'var(--color-primary)' }}>
          GSM SPORTS
        </h1>
        <p className="text-xl" style={{ color: 'var(--color-text-secondary)' }}>
          {t('subtitle')}
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <a
            href="/tournaments"
            className="px-6 py-3 rounded-lg font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {t('tournaments')}
          </a>
          <a
            href="/rankings"
            className="px-6 py-3 rounded-lg font-semibold border"
            style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
          >
            {t('rankings')}
          </a>
        </div>
      </div>
    </main>
  );
}
