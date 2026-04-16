'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useCreateNews } from '@/hooks/useNews';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { ImageUpload } from '@/components/admin/ImageUpload';

const schema = z.object({
  title: z.string().min(1, 'Required'),
  content: z.string().min(1, 'Required'),
  excerpt: z.string().optional(),
  coverImage: z.string().optional(),
  category: z.string().min(1),
  status: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

const FIELD_CLASS =
  'w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors';
const LABEL_CLASS =
  'block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--color-text-secondary)]';

export default function NewNewsPage() {
  const t = useTranslations('admin_news');
  const tCat = useTranslations('news');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const createMutation = useCreateNews();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      content: '',
      excerpt: '',
      coverImage: '',
      category: 'news',
      status: 'published',
    },
  });

  const status = watch('status');

  const onValid = (values: FormValues) => {
    createMutation.mutate(
      {
        title: values.title,
        content: values.content,
        excerpt: values.excerpt || undefined,
        coverImage: values.coverImage || undefined,
        category: values.category,
        status: values.status,
      },
      { onSuccess: () => router.push('/admin/news') },
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">{t('new_title')}</h1>
      </div>

      <form onSubmit={handleSubmit(onValid)} className="space-y-6">
        {/* Title */}
        <div>
          <label className={LABEL_CLASS}>{t('field_title')}</label>
          <input
            {...register('title')}
            placeholder={t('field_title_placeholder')}
            className={`${FIELD_CLASS} text-lg font-semibold`}
          />
          {errors.title && (
            <p className="text-red-400 text-xs mt-1">{tCommon('error_required')}</p>
          )}
        </div>

        {/* Category + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>{t('field_category')}</label>
            <select
              {...register('category')}
              className={`${FIELD_CLASS} bg-[var(--color-secondary)]`}
            >
              <option value="news">{tCat('cat_news')}</option>
              <option value="business">{tCat('cat_business')}</option>
              <option value="sport">{tCat('cat_sport')}</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>{t('field_status')}</label>
            <select
              {...register('status')}
              className={`${FIELD_CLASS} bg-[var(--color-secondary)]`}
            >
              <option value="draft">{t('status_draft')}</option>
              <option value="published">{t('status_published')}</option>
            </select>
          </div>
        </div>

        {/* Excerpt */}
        <div>
          <label className={LABEL_CLASS}>{t('field_excerpt')}</label>
          <textarea
            {...register('excerpt')}
            rows={2}
            placeholder={t('field_excerpt_placeholder')}
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>

        {/* Cover Image */}
        <Controller
          name="coverImage"
          control={control}
          render={({ field }) => <ImageUpload value={field.value ?? ''} onChange={field.onChange} />}
        />

        {/* Content */}
        <div>
          <label className={LABEL_CLASS}>{t('field_content')}</label>
          <Controller
            name="content"
            control={control}
            render={({ field }) => (
              <RichTextEditor
                value={field.value}
                onChange={field.onChange}
                placeholder={t('field_content_placeholder')}
              />
            )}
          />
          {errors.content && (
            <p className="text-red-400 text-xs mt-1">{tCommon('error_required')}</p>
          )}
        </div>

        {createMutation.isError && (
          <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
            {t('error_save')}:{' '}
            {(createMutation.error as any)?.response?.data?.message ??
              (createMutation.error as any)?.message ??
              ''}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50 bg-[var(--color-accent)]"
          >
            {createMutation.isPending
              ? t('submitting')
              : status === 'published'
                ? t('submit_publish')
                : t('submit_draft')}
          </button>
          <Link
            href="/admin/news"
            className="px-6 py-3 rounded-xl font-medium border border-white/10 hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
          >
            {t('cancel')}
          </Link>
        </div>
      </form>
    </div>
  );
}
