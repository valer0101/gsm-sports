'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { useSports, type AthletePayload } from '@/hooks/useAthletes';
import type { Athlete } from '@/types/api';

interface Props {
  initial?: Athlete;
  onSubmit: (data: AthletePayload) => void;
  isPending: boolean;
  isError: boolean;
  error?: any;
}

const FIELD_CLASS =
  'w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors text-sm';
const SELECT_CLASS = `${FIELD_CLASS} `;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-xs font-semibold uppercase tracking-wider mb-2"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </label>
  );
}

export function AthleteForm({ initial, onSubmit, isPending, isError, error }: Props) {
  const router = useRouter();
  const { data: sports } = useSports();

  const [sportId, setSportId] = useState(initial?.sport?.id ?? '');
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [gender, setGender] = useState(initial?.gender ?? '');
  const [primaryHand, setPrimaryHand] = useState(initial?.primaryHand ?? '');
  const [weight, setWeight] = useState(initial?.weight ? String(initial.weight) : '');
  const [height, setHeight] = useState(initial?.height ? String(initial.height) : '');
  const [experienceLevel, setExperienceLevel] = useState(initial?.experienceLevel ?? '');
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? '');
  const [bioRu, setBioRu] = useState((initial as any)?.bioRu ?? '');

  useEffect(() => {
    if (initial) {
      setSportId(initial.sport?.id ?? '');
      setFirstName(initial.firstName);
      setLastName(initial.lastName);
      setCountry(initial.country ?? '');
      setCity(initial.city ?? '');
      setGender(initial.gender ?? '');
      setPrimaryHand(initial.primaryHand ?? '');
      setWeight(initial.weight ? String(initial.weight) : '');
      setHeight(initial.height ? String(initial.height) : '');
      setExperienceLevel(initial.experienceLevel ?? '');
      setPhotoUrl(initial.photoUrl ?? '');
      setBioRu((initial as any)?.bioRu ?? '');
    }
  }, [initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      sportId,
      firstName,
      lastName,
      country: country || undefined,
      city: city || undefined,
      gender: gender || undefined,
      primaryHand: primaryHand || undefined,
      weight: weight ? Number(weight) : undefined,
      height: height ? Number(height) : undefined,
      experienceLevel: experienceLevel || undefined,
      photoUrl: photoUrl || undefined,
      bioRu: bioRu || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Photo */}
      <ImageUpload value={photoUrl} onChange={setPhotoUrl} label="Фото спортсмена" />

      {/* Basic */}
      <div>
        <h2
          className="text-xs font-black uppercase tracking-widest mb-4 pb-2 border-b border-white/10"
          style={{ color: 'var(--color-accent)' }}
        >
          Основная информация
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Имя *</Label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <Label>Фамилия *</Label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <Label>Вид спорта *</Label>
            <select
              value={sportId}
              onChange={(e) => setSportId(e.target.value)}
              required
              className={SELECT_CLASS}
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <option value="">Выберите вид спорта</option>
              {sports?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameRu}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Уровень</Label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              className={SELECT_CLASS}
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <option value="">Не указан</option>
              <option value="beginner">Начинающий</option>
              <option value="intermediate">Средний</option>
              <option value="advanced">Продвинутый</option>
              <option value="professional">Профессионал</option>
            </select>
          </div>
        </div>
      </div>

      {/* Personal */}
      <div>
        <h2
          className="text-xs font-black uppercase tracking-widest mb-4 pb-2 border-b border-white/10"
          style={{ color: 'var(--color-accent)' }}
        >
          Персональные данные
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Пол</Label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={SELECT_CLASS}
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <option value="">Не указан</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </div>
          <div>
            <Label>Рабочая рука</Label>
            <select
              value={primaryHand}
              onChange={(e) => setPrimaryHand(e.target.value)}
              className={SELECT_CLASS}
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <option value="">Не указана</option>
              <option value="right">Правая</option>
              <option value="left">Левая</option>
              <option value="both">Обе</option>
            </select>
          </div>
          <div>
            <Label>Вес (кг)</Label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              min={20}
              max={300}
              step={0.1}
              placeholder="70.5"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <Label>Рост (см)</Label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              min={100}
              max={250}
              placeholder="175"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <Label>Страна</Label>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Armenia"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <Label>Город</Label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Yerevan"
              className={FIELD_CLASS}
            />
          </div>
        </div>
      </div>

      {/* Bio */}
      <div>
        <h2
          className="text-xs font-black uppercase tracking-widest mb-4 pb-2 border-b border-white/10"
          style={{ color: 'var(--color-accent)' }}
        >
          Биография
        </h2>
        <div>
          <Label>Биография (рус)</Label>
          <textarea
            value={bioRu}
            onChange={(e) => setBioRu(e.target.value)}
            rows={4}
            placeholder="Описание спортсмена..."
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>
      </div>

      {isError && (
        <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
          Ошибка: {error?.response?.data?.message ?? error?.message ?? 'Не удалось сохранить'}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || !firstName || !lastName || !sportId}
          className="px-6 py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {isPending ? 'Сохраняем...' : 'Сохранить'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/athletes')}
          className="px-6 py-3 rounded-xl font-medium border border-white/10 hover:bg-white/10 transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
