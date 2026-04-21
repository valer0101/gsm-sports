'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

interface Props {
  value: string | null | undefined;
  onChange: (url: string) => void;
  size?: number;
  fallbackInitials?: string;
}

export function AvatarUpload({ value, onChange, size = 120, fallbackInitials }: Props) {
  const t = useTranslations('common');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/upload/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange((res as any).data.url);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('upload_error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative rounded-full overflow-hidden border border-white/15 shrink-0 bg-white/5 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {value ? (
          <Image src={value} alt="avatar" fill className="object-cover" sizes={`${size}px`} unoptimized />
        ) : fallbackInitials ? (
          <span className="text-2xl font-bold text-white/70 select-none">{fallbackInitials}</span>
        ) : (
          <svg className="w-1/2 h-1/2 text-white/40" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {value ? t('replace') : t('drop_or_click_file')}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={uploading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            {t('remove')}
          </button>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
