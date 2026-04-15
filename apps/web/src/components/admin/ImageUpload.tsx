'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export function ImageUpload({ value, onChange, label = 'Обложка' }: Props) {
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
      setError(e?.response?.data?.message ?? 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <label
        className="block text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </label>

      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-white/15 group">
          <div className="relative w-full aspect-[16/7]">
            <Image src={value} alt="cover" fill className="object-cover" />
          </div>
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white border border-white/30 hover:bg-white/20 transition-colors"
            >
              Заменить
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
            >
              Удалить
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="w-full aspect-[16/7] rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 transition-colors flex flex-col items-center justify-center gap-3 cursor-pointer"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Загрузка...
              </p>
            </div>
          ) : (
            <>
              <svg
                className="w-10 h-10"
                style={{ color: 'var(--color-text-secondary)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Нажмите или перетащите файл</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  JPEG, PNG, WebP — до 5 МБ
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

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
