'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string;
  status: string;
  authorId: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewsPayload {
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  category: string;
  status: string;
}

export function useAdminNews(page = 1) {
  return useQuery<{ items: NewsItem[]; total: number }>({
    queryKey: ['admin', 'news', page],
    queryFn: () => api.get(`/news/admin/all?page=${page}&limit=20`).then((r: any) => r.data),
  });
}

export function useNewsItem(id: string) {
  return useQuery<NewsItem>({
    queryKey: ['admin', 'news', 'item', id],
    queryFn: () => api.get(`/news/${id}`).then((r: any) => r.data),
    enabled: !!id,
  });
}

export function useCreateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NewsPayload) => api.post('/news', data).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'news'] }),
  });
}

export function useUpdateNews(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NewsPayload>) =>
      api.patch(`/news/${id}`, data).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'news'] });
      qc.invalidateQueries({ queryKey: ['admin', 'news', 'item', id] });
    },
  });
}

export function useDeleteNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/news/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'news'] }),
  });
}

export function usePublishNewsItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/news/${id}`, { status: 'published' }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'news'] }),
  });
}

export function usePublicNews(category?: string, page = 1) {
  return useQuery<{ items: NewsItem[]; total: number }>({
    queryKey: ['news', category, page],
    queryFn: () =>
      api
        .get(`/news?page=${page}&limit=12${category ? `&category=${category}` : ''}`)
        .then((r: any) => r.data),
  });
}

export function useNewsBySlug(slug: string) {
  return useQuery<NewsItem>({
    queryKey: ['news', 'slug', slug],
    queryFn: () => api.get(`/news/${slug}`).then((r: any) => r.data),
    enabled: !!slug,
  });
}
