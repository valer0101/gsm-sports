'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Icon } from '../../_lib/icons';

type Props = {
  url: string | null;                    // absolute URL after upload (what gets sent to /admin/tournaments)
  onChange: (url: string | null) => void;
};

export function PosterUpload({ url, onChange }: Props) {
  const t = useTranslations('tournament_wizard');
  const [drag, setDrag] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const display = localPreview || url;

  const onFile = async (file: File) => {
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError(t('poster_size_error'));
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(t('poster_format_error'));
      return;
    }
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => setLocalPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.url);
      setLocalPreview(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? t('poster_upload_error');
      setError(msg);
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    onChange(null);
    setLocalPreview(null);
    setError(null);
  };

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={[
          'relative block w-full aspect-[16/9] rounded-[10px] border-2 border-dashed cursor-pointer transition-all overflow-hidden',
          drag
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-dim)]'
            : display
            ? 'border-[var(--color-border)] bg-black'
            : 'border-[var(--color-border-strong)] bg-[var(--color-surface-2)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-dim)]',
        ].join(' ')}
      >
        {display ? (
          <>
            {/* `unoptimized` covers the data:URL preview shown while the
                upload is mid-flight; once the server returns a public URL
                next/image swaps to it transparently. */}
            <Image
              src={display}
              alt="Poster preview"
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              unoptimized
              className={`object-cover ${uploading ? 'opacity-50' : ''}`}
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="h-8 w-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); clear(); }}
                className="px-2.5 py-1.5 text-xs font-semibold bg-black/70 hover:bg-black text-white rounded backdrop-blur transition-colors"
              >
                {t('poster_replace')}
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); clear(); }}
                className="h-7 w-7 flex items-center justify-center bg-black/70 hover:bg-[var(--color-primary)] text-white rounded backdrop-blur transition-colors"
              >
                {Icon.x('h-3.5 w-3.5')}
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
            <div className="text-[var(--color-text-secondary)]">{Icon.imagePlus()}</div>
            <div className="text-sm font-semibold">{t('poster_dropzone')}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{t('poster_hint')}</div>
          </div>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
      {error && (
        <div className="mt-2 text-xs text-[var(--color-error)]">{error}</div>
      )}
    </div>
  );
}
