'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useCreateTournament } from '@/hooks/useAdmin';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Sport } from '@/types/api';

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const nowStr = toDatetimeLocal(new Date());

// ─── Constants ───────────────────────────────────────────────────────────────
const COMPETITION_TYPES = [
  { value: 'setka', label: 'Сетка', desc: 'Double Elimination по весовым категориям' },
  { value: 'armfight', label: 'Armfight', desc: 'Один на один, без сетки' },
];

const AGE_GROUPS = [
  { value: 'juniors', label: 'Юниоры (до 18)' },
  { value: 'adults', label: 'Взрослые' },
  { value: 'veterans', label: 'Ветераны (40+)' },
];

const WEIGHT_PRESETS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110];

const PRIZE_TYPES = [
  { value: 'money', label: 'Деньги', emoji: '💰' },
  { value: 'medal', label: 'Медаль', emoji: '🥇' },
  { value: 'trophy', label: 'Трофей', emoji: '🏆' },
  { value: 'certificate', label: 'Сертификат', emoji: '📜' },
  { value: 'custom', label: 'Другое', emoji: '🎁' },
];

interface PrizeItem {
  id: string;
  place: string;
  type: string;
  value: string;
  description: string;
}

function buildWeightCategories(selected: number[], hasPlus: boolean, custom: string) {
  const sorted = [...selected].sort((a, b) => a - b);
  const result = sorted.map((kg, idx) => ({
    name: `${kg} кг`,
    minWeight: idx === 0 ? null : sorted[idx - 1],
    maxWeight: kg,
    sortOrder: idx,
  }));
  if (hasPlus) {
    const last = sorted.length > 0 ? sorted[sorted.length - 1] : 110;
    result.push({
      name: `${last}+ кг`,
      minWeight: last,
      maxWeight: null,
      sortOrder: result.length,
    });
  }
  if (custom.trim()) {
    result.push({
      name: custom.trim(),
      minWeight: null,
      maxWeight: null,
      sortOrder: result.length,
    });
  }
  return result;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function NewTournamentPage() {
  const router = useRouter();
  const { mutate, isPending, error } = useCreateTournament();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: sports, isLoading: sportsLoading } = useQuery<Sport[]>({
    queryKey: ['sports', 'all'],
    queryFn: async () => {
      const r = await api.get('/sports', { params: { limit: 100 } });
      const p = r.data;
      if (Array.isArray(p)) return p;
      if (Array.isArray(p?.data)) return p.data;
      return [];
    },
  });

  // Basic
  const [form, setForm] = useState({
    name: '',
    sportId: '',
    startDate: '',
    endDate: '',
    location: '',
    city: '',
    country: '',
    descriptionRu: '',
    maxParticipants: '',
  });

  // Poster
  const [posterUrl, setPosterUrl] = useState('');
  const [posterPreview, setPosterPreview] = useState('');
  const [uploading, setUploading] = useState(false);

  // Competition config
  const [competitionType, setCompetitionType] = useState<'setka' | 'armfight'>('setka');
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [selectedWeights, setSelectedWeights] = useState<number[]>([]);
  const [weightPlus, setWeightPlus] = useState(false);
  const [customWeight, setCustomWeight] = useState('');
  const [hands, setHands] = useState<string[]>(['right']);
  const [entryFeeType, setEntryFeeType] = useState<'free' | 'paid'>('free');
  const [entryFeeAmount, setEntryFeeAmount] = useState('');
  const [entryFeeDesc, setEntryFeeDesc] = useState('');

  // Prizes
  const [prizes, setPrizes] = useState<PrizeItem[]>([]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      if (name === 'startDate' && next.endDate && next.endDate <= value) next.endDate = '';
      return next;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview instantly
    const local = URL.createObjectURL(file);
    setPosterPreview(local);
    // Upload to API
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPosterUrl(res.data.url);
    } catch {
      alert('Ошибка загрузки изображения');
      setPosterPreview('');
    } finally {
      setUploading(false);
    }
  }

  function toggleAgeGroup(val: string) {
    setAgeGroups((p) => (p.includes(val) ? p.filter((x) => x !== val) : [...p, val]));
  }
  function toggleWeight(kg: number) {
    setSelectedWeights((p) => (p.includes(kg) ? p.filter((x) => x !== kg) : [...p, kg]));
  }
  function toggleHand(val: string) {
    if (val === 'both') {
      setHands(['right', 'left']);
      return;
    }
    setHands((p) => {
      if (p.includes('right') && p.includes('left')) return [val];
      return p.includes(val) ? p.filter((x) => x !== val) : [...p, val];
    });
  }
  const handsLabel =
    hands.includes('right') && hands.includes('left') ? 'both' : (hands[0] ?? 'right');

  function addPrize() {
    setPrizes((p) => [
      ...p,
      {
        id: Date.now().toString(),
        place: String(p.length + 1),
        type: 'money',
        value: '',
        description: '',
      },
    ]);
  }
  function removePrize(id: string) {
    setPrizes((p) => p.filter((x) => x.id !== id));
  }
  function updatePrize(id: string, field: keyof PrizeItem, val: string) {
    setPrizes((p) => p.map((x) => (x.id === id ? { ...x, [field]: val } : x)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const weightCats = buildWeightCategories(selectedWeights, weightPlus, customWeight);
    const sportConfig: Record<string, unknown> = {
      competitionType,
      hands,
      entryFee: {
        type: entryFeeType,
        amount: entryFeeType === 'paid' && entryFeeAmount ? parseFloat(entryFeeAmount) : null,
        description: entryFeeDesc || null,
      },
      prizes: prizes.map(({ id: _id, ...p }) => p),
    };
    if (competitionType === 'setka') sportConfig.ageGroups = ageGroups;

    mutate(
      {
        ...form,
        maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : undefined,
        endDate: form.endDate || undefined,
        posterUrl: posterUrl || undefined,
        sportConfig,
        weightCategories: weightCats.length > 0 ? weightCats : undefined,
      } as any,
      { onSuccess: () => router.push('/admin') },
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        ← Назад
      </Link>
      <h1 className="text-2xl font-black text-white mb-8">Новый турнир</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── Постер ─── */}
        <Section title="Постер турнира">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          {posterPreview ? (
            <div className="relative w-full h-48 rounded-xl overflow-hidden mb-3">
              <Image src={posterPreview} alt="poster" fill className="object-cover" unoptimized />
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white text-sm">Загрузка...</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setPosterPreview('');
                  setPosterUrl('');
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-36 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 hover:border-white/40 transition-colors cursor-pointer"
            >
              <span className="text-3xl">🖼️</span>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Нажмите чтобы выбрать картинку
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                JPEG, PNG, WebP · до 5 МБ
              </span>
            </button>
          )}
          {posterUrl && !uploading && (
            <p className="text-xs text-green-400 mt-1">✓ Картинка загружена</p>
          )}
        </Section>

        {/* ─── Основная информация ─── */}
        <Section title="Основная информация">
          <Field label="Название *">
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Чемпионат Армении 2026"
              className="w-full px-4 py-2.5 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </Field>
          <Field label="Вид спорта *">
            <select
              name="sportId"
              value={form.sportId}
              onChange={handleChange}
              required
              disabled={sportsLoading}
              className="w-full px-4 py-2.5 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              style={{ backgroundColor: 'var(--color-bg)' }}
            >
              <option value="">
                {sportsLoading
                  ? 'Загрузка...'
                  : sports?.length === 0
                    ? 'Нет видов спорта'
                    : '— выберите —'}
              </option>
              {sports?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameRu || s.nameEn || s.nameHy}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Дата начала *">
              <input
                type="datetime-local"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                required
                min={nowStr}
                className="w-full px-4 py-2.5 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </Field>
            <Field label="Дата окончания">
              <input
                type="datetime-local"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                min={form.startDate || nowStr}
                disabled={!form.startDate}
                className="inp disabled:opacity-40"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Город">
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Ереван"
                className="w-full px-4 py-2.5 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </Field>
            <Field label="Страна">
              <input
                name="country"
                value={form.country}
                onChange={handleChange}
                placeholder="Армения"
                className="w-full px-4 py-2.5 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </Field>
          </div>
          <Field label="Место проведения *">
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              required
              placeholder="Спортивный комплекс «Арена»"
              className="w-full px-4 py-2.5 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </Field>
          <Field label="Макс. участников">
            <input
              type="number"
              name="maxParticipants"
              value={form.maxParticipants}
              onChange={handleChange}
              min={2}
              placeholder="64"
              className="w-full px-4 py-2.5 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </Field>
          <Field label="Описание (рус.)">
            <textarea
              name="descriptionRu"
              value={form.descriptionRu}
              onChange={handleChange}
              rows={3}
              placeholder="Описание турнира..."
              className="inp resize-none"
            />
          </Field>
        </Section>

        {/* ─── Тип соревнования ─── */}
        <Section title="Тип соревнования">
          <div className="grid grid-cols-2 gap-3">
            {COMPETITION_TYPES.map((ct) => (
              <button
                key={ct.value}
                type="button"
                onClick={() => setCompetitionType(ct.value as any)}
                className="text-left p-4 rounded-xl border transition-colors"
                style={{
                  borderColor:
                    competitionType === ct.value ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                  backgroundColor:
                    competitionType === ct.value ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}
              >
                <p className="font-bold text-white">{ct.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {ct.desc}
                </p>
              </button>
            ))}
          </div>
        </Section>

        {/* ─── Возрастные группы ─── */}
        {competitionType === 'setka' && (
          <Section title="Возрастные группы">
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Выберите одну или несколько. Если не выбрать — без ограничений.
            </p>
            <div className="space-y-2">
              {AGE_GROUPS.map((ag) => (
                <label
                  key={ag.value}
                  className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                  style={{
                    borderColor: ageGroups.includes(ag.value)
                      ? 'var(--color-accent)'
                      : 'rgba(255,255,255,0.08)',
                    backgroundColor: ageGroups.includes(ag.value)
                      ? 'rgba(255,255,255,0.04)'
                      : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ageGroups.includes(ag.value)}
                    onChange={() => toggleAgeGroup(ag.value)}
                    className="w-4 h-4 accent-[var(--color-accent)]"
                  />
                  <span className="text-sm text-white">{ag.label}</span>
                </label>
              ))}
            </div>
          </Section>
        )}

        {/* ─── Весовые категории ─── */}
        <Section title="Весовые категории">
          <div className="flex flex-wrap gap-2 mb-3">
            {WEIGHT_PRESETS.map((kg) => (
              <button
                key={kg}
                type="button"
                onClick={() => toggleWeight(kg)}
                className="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
                style={{
                  borderColor: selectedWeights.includes(kg)
                    ? 'var(--color-accent)'
                    : 'rgba(255,255,255,0.15)',
                  backgroundColor: selectedWeights.includes(kg)
                    ? 'rgba(255,255,255,0.08)'
                    : 'transparent',
                  color: selectedWeights.includes(kg) ? 'white' : 'var(--color-text-secondary)',
                }}
              >
                {kg} кг
              </button>
            ))}
            <button
              type="button"
              onClick={() => setWeightPlus((p) => !p)}
              className="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
              style={{
                borderColor: weightPlus ? 'var(--color-accent)' : 'rgba(255,255,255,0.15)',
                backgroundColor: weightPlus ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: weightPlus ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              110+ кг
            </button>
          </div>
          <input
            value={customWeight}
            onChange={(e) => setCustomWeight(e.target.value)}
            placeholder="Своя категория (напр. 80+)"
            className="inp text-sm py-2"
          />
          {(selectedWeights.length > 0 || weightPlus || customWeight.trim()) && (
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Выбрано:{' '}
              {buildWeightCategories(selectedWeights, weightPlus, customWeight)
                .map((w) => w.name)
                .join(' · ')}
            </p>
          )}
        </Section>

        {/* ─── Рука ─── */}
        <Section title="Рука">
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'right', label: 'Правая', emoji: '🤜' },
              { value: 'left', label: 'Левая', emoji: '🤛' },
              { value: 'both', label: 'Обе', emoji: '🤜🤛' },
            ].map((h) => (
              <button
                key={h.value}
                type="button"
                onClick={() => toggleHand(h.value)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors"
                style={{
                  borderColor:
                    handsLabel === h.value ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                  backgroundColor:
                    handsLabel === h.value ? 'rgba(255,255,255,0.06)' : 'transparent',
                }}
              >
                <span className="text-2xl">{h.emoji}</span>
                <span className="text-sm font-medium text-white">{h.label}</span>
              </button>
            ))}
          </div>
          {hands.includes('right') && hands.includes('left') && (
            <p className="mt-2 text-xs text-yellow-400">
              При «Обе» участники регистрируются отдельно в правую и левую сетку.
            </p>
          )}
        </Section>

        {/* ─── Взнос ─── */}
        <Section title="Вступительный взнос">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { value: 'free', label: 'Бесплатно', emoji: '🎁' },
              { value: 'paid', label: 'Платный', emoji: '💰' },
            ].map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setEntryFeeType(f.value as any)}
                className="flex items-center gap-3 p-4 rounded-xl border transition-colors"
                style={{
                  borderColor:
                    entryFeeType === f.value ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                  backgroundColor:
                    entryFeeType === f.value ? 'rgba(255,255,255,0.06)' : 'transparent',
                }}
              >
                <span className="text-xl">{f.emoji}</span>
                <span className="text-sm font-medium text-white">{f.label}</span>
              </button>
            ))}
          </div>
          {entryFeeType === 'paid' && (
            <div className="space-y-3">
              <Field label="Сумма взноса">
                <div className="relative">
                  <input
                    type="number"
                    value={entryFeeAmount}
                    onChange={(e) => setEntryFeeAmount(e.target.value)}
                    placeholder="5000"
                    min={0}
                    step={100}
                    className="inp pr-16"
                  />
                  <span
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    AMD
                  </span>
                </div>
              </Field>
              <Field label="Условия оплаты">
                <input
                  value={entryFeeDesc}
                  onChange={(e) => setEntryFeeDesc(e.target.value)}
                  placeholder="Оплата на месте, наличными"
                  className="w-full px-4 py-2.5 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
                />
              </Field>
            </div>
          )}
        </Section>

        {/* ─── Призы ─── */}
        <Section title="Призовой фонд">
          {prizes.length === 0 && (
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Призы не добавлены. Если добавить — они будут показаны участникам при регистрации.
            </p>
          )}
          <div className="space-y-3 mb-4">
            {prizes.map((prize, idx) => (
              <div
                key={prize.id}
                className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">Приз #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removePrize(prize.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Удалить
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Место">
                    <input
                      value={prize.place}
                      onChange={(e) => updatePrize(prize.id, 'place', e.target.value)}
                      placeholder="1"
                      className="inp text-sm py-2"
                    />
                  </Field>
                  <Field label="Тип приза">
                    <select
                      value={prize.type}
                      onChange={(e) => updatePrize(prize.id, 'type', e.target.value)}
                      className="inp text-sm py-2"
                      style={{ backgroundColor: 'var(--color-bg)' }}
                    >
                      {PRIZE_TYPES.map((pt) => (
                        <option key={pt.value} value={pt.value}>
                          {pt.emoji} {pt.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {prize.type === 'money' && (
                  <Field label="Сумма (AMD)">
                    <input
                      value={prize.value}
                      onChange={(e) => updatePrize(prize.id, 'value', e.target.value)}
                      placeholder="50000"
                      type="number"
                      className="inp text-sm py-2"
                    />
                  </Field>
                )}
                <Field label="Описание">
                  <input
                    value={prize.description}
                    onChange={(e) => updatePrize(prize.id, 'description', e.target.value)}
                    placeholder={
                      prize.type === 'money'
                        ? 'Денежный приз победителю'
                        : prize.type === 'medal'
                          ? 'Золотая медаль WAF'
                          : 'Описание приза'
                    }
                    className="inp text-sm py-2"
                  />
                </Field>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPrize}
            className="w-full py-2.5 rounded-xl border border-dashed border-white/20 text-sm hover:border-white/40 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            + Добавить приз
          </button>
        </Section>

        {/* ─── Submit ─── */}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 px-4 py-3 rounded-xl">
            {(error as any)?.response?.data?.message ?? 'Ошибка создания турнира'}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending || uploading}
            className="flex-1 py-3 rounded-xl font-bold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
          >
            {isPending ? 'Создание...' : uploading ? 'Загрузка картинки...' : 'Создать турнир'}
          </button>
          <Link
            href="/admin"
            className="px-5 py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Отмена
          </Link>
        </div>
      </form>


    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-white/10 p-6 space-y-5"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <h2 className="text-base font-bold text-white border-b border-white/10 pb-3">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
