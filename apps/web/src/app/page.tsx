import { useTranslations } from 'next-intl';
import Link from 'next/link';

function HeroSection() {
  const t = useTranslations('home');

  return (
    <section className="relative overflow-hidden py-20 px-4">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: 'var(--color-primary)' }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto text-center space-y-6">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 text-sm mb-4"
          style={{ color: 'var(--color-accent)' }}
        >
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          GSM Sports Platform
        </div>

        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">
          <span style={{ color: 'var(--color-primary)' }}>GSM</span>{' '}
          <span className="text-white">SPORTS</span>
        </h1>

        <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          {t('subtitle')}
        </p>

        <div className="flex flex-wrap gap-4 justify-center mt-8">
          <Link
            href="/tournaments"
            className="px-7 py-3.5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {t('hero_cta')}
          </Link>
          <Link
            href="/rankings"
            className="px-7 py-3.5 rounded-xl font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
          >
            {t('rankings')}
          </Link>
          <Link
            href="/athletes"
            className="px-7 py-3.5 rounded-xl font-semibold border border-white/20 transition-colors hover:bg-white/5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('athletes')}
          </Link>
        </div>
      </div>
    </section>
  );
}

function QuickLinks() {
  const links = [
    { href: '/tournaments', icon: '🏆', labelKey: 'tournaments', descKey: 'subtitle' },
    { href: '/athletes', icon: '💪', labelKey: 'athletes', descKey: 'subtitle' },
    { href: '/rankings', icon: '📊', labelKey: 'rankings', descKey: 'subtitle' },
  ] as const;

  const tNav = useTranslations('nav');
  const tTournaments = useTranslations('tournaments');
  const tAthletes = useTranslations('athletes');
  const tRankings = useTranslations('rankings');

  const descs = [tTournaments('subtitle'), tAthletes('subtitle'), tRankings('subtitle')];

  return (
    <section className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
      {links.map(({ href, icon, labelKey }, i) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col gap-3 rounded-xl border border-white/10 p-6 transition-all hover:border-white/25 hover:-translate-y-1"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <span className="text-3xl">{icon}</span>
          <span className="font-bold text-white text-lg">{tNav(labelKey)}</span>
          <span
            className="text-sm leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {descs[i]}
          </span>
        </Link>
      ))}
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <QuickLinks />
    </>
  );
}
