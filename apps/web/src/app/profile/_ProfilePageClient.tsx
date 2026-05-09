'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUpdateMe } from '@/hooks/useProfile';
import {
  useTelegramLink,
  useIssueTelegramLinkToken,
  useUnlinkTelegram,
  type TelegramLinkToken,
} from '@/hooks/useTelegram';
import { AvatarUpload } from '@/components/AvatarUpload';
import { CountryPicker } from '@/components/ui/CountryPicker';
import { PasswordSection } from './_PasswordSection';

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
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--color-text-secondary)]">
              {t('country')}
            </label>
            <CountryPicker value={country} onChange={setCountry} allowFreeText />
          </div>
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

      <div className="mt-6">
        <PasswordSection />
      </div>

      {/* Telegram notifications — opt-in. Hidden for anon visitors (they
          can't reach /profile anyway) and for users who haven't finished
          onboarding. */}
      <div className="mt-6">
        <TelegramLinkSection />
      </div>
    </div>
  );
}

function TelegramLinkSection() {
  const t = useTranslations('profile_telegram');
  const { data: link, isLoading } = useTelegramLink();
  const issueToken = useIssueTelegramLinkToken();
  const unlink = useUnlinkTelegram();

  const [qr, setQr] = useState<TelegramLinkToken | null>(null);

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border border-white/10 p-6 animate-pulse h-24"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      />
    );
  }

  // ─── Already linked: show status + unlink ─────────────────────────
  if (link) {
    return (
      <div
        className="rounded-2xl border p-6"
        style={{
          backgroundColor: 'var(--color-secondary)',
          borderColor: 'rgba(16,185,129,0.3)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider mb-1"
               style={{ color: 'var(--color-text-secondary)' }}>
              {t('section_label')}
            </p>
            <p className="text-white font-semibold">
              ✓ {t('connected_as', { masked: link.chatIdMasked })}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {t('connected_since', {
                date: new Date(link.linkedAt).toLocaleDateString(),
              })}
            </p>
          </div>
          <button
            onClick={() => unlink.mutate()}
            disabled={unlink.isPending}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-50"
            style={{
              borderColor: 'rgba(239,68,68,0.3)',
              color: '#f87171',
            }}
          >
            {unlink.isPending ? '...' : t('unlink')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Not linked: connect CTA + on-demand QR ───────────────────────
  return (
    <div
      className="rounded-2xl border border-white/10 p-6"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <p className="text-xs uppercase tracking-wider mb-1"
         style={{ color: 'var(--color-text-secondary)' }}>
        {t('section_label')}
      </p>
      <p className="text-white font-semibold mb-1">{t('headline')}</p>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        {t('description')}
      </p>

      {!qr && (
        <button
          onClick={() =>
            issueToken.mutate(undefined, {
              onSuccess: (data) => setQr(data),
            })
          }
          disabled={issueToken.isPending}
          className="px-4 py-2 rounded-xl font-bold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {issueToken.isPending ? '...' : t('connect_btn')}
        </button>
      )}

      {issueToken.error && (
        <p className="mt-3 text-xs text-red-400">
          {(issueToken.error as any)?.response?.data?.message ?? t('error')}
        </p>
      )}

      {qr && (
        <div className="mt-4 flex flex-col sm:flex-row items-start gap-5">
          {/* QR — white background mandatory for phone cameras to lock on. */}
          <div className="shrink-0 rounded-xl bg-white p-3">
            <QRCodeSVG value={qr.deepLink} size={160} level="M" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-white mb-2">{t('qr_hint')}</p>
            <a
              href={qr.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 rounded-lg text-sm font-bold"
              style={{
                backgroundColor: 'var(--color-accent-dim)',
                color: 'var(--color-accent)',
              }}
            >
              {t('open_in_telegram')}
            </a>
            <p className="text-xs mt-3" style={{ color: 'var(--color-text-secondary)' }}>
              {t('expires_at', {
                time: new Date(qr.expiresAt).toLocaleTimeString(),
              })}
            </p>
            <button
              onClick={() => setQr(null)}
              className="text-xs mt-2 underline"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
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
