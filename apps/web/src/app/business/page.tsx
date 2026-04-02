import { useTranslations } from 'next-intl';

export default function BusinessPage() {
  const t = useTranslations('nav');

  return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <h1
        className="text-4xl font-black mb-4"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {t('business')}
      </h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>Coming soon.</p>
    </div>
  );
}
