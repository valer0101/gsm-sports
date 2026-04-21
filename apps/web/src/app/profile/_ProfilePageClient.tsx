'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUpdateMe } from '@/hooks/useProfile';
import { AvatarUpload } from '@/components/AvatarUpload';

export function ProfilePageClient() {
  const t = useTranslations('profile');
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUser();
  const { mutate, isPending } = useUpdateMe();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setAvatarUrl(user.avatarUrl ?? null);
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setCountry((user as any).country ?? '');
    setCity((user as any).city ?? '');
  }, [user]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/auth/login?redirect=/profile');
  }, [isLoading, user, router]);

  const handleSave = () => {
    setSaved(false);
    setError(null);
    mutate(
      {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        avatarUrl: avatarUrl ?? '',
        country: country || undefined,
        city: city || undefined,
      },
      {
        onSuccess: () => setSaved(true),
        onError: (e: any) => setError(e?.response?.data?.message ?? t('save_error')),
      },
    );
  };

  if (isLoading || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="h-8 w-40 bg-white/5 rounded mb-6 animate-pulse" />
        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const initials =
    (firstName?.[0] ?? user.firstName?.[0] ?? '').toUpperCase() +
    (lastName?.[0] ?? user.lastName?.[0] ?? '').toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-black text-white mb-6">{t('title')}</h1>

      <div
        className="rounded-2xl border border-white/10 p-6 space-y-6"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        {/* Avatar */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-3 text-[var(--color-text-secondary)]">
            {t('avatar')}
          </label>
          <AvatarUpload
            value={avatarUrl}
            onChange={(url) => setAvatarUrl(url || null)}
            size={120}
            fallbackInitials={initials}
          />
        </div>

        {/* Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('first_name')} value={firstName} onChange={setFirstName} />
          <Field label={t('last_name')} value={lastName} onChange={setLastName} />
        </div>

        {/* Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('country')} value={country} onChange={setCountry} />
          <Field label={t('city')} value={city} onChange={setCity} />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--color-text-secondary)]">
            {t('email')}
          </label>
          <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70">
            {user.email}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-green-400">{t('saved')}</p>}

        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {isPending ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--color-text-secondary)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-white/30 focus:outline-none"
      />
    </div>
  );
}
