import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NewsService } from './news.service';
import { News } from './entities/news.entity';

const mockQueryBuilder = {
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  addOrderBy: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  take: vi.fn().mockReturnThis(),
  andWhere: vi.fn().mockReturnThis(),
  getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
};

const mockRepository = {
  createQueryBuilder: vi.fn(() => mockQueryBuilder),
  findAndCount: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockNews = (overrides: Partial<News> = {}): News =>
  ({
    id: 'news-uuid-1',
    title: 'Test Article',
    slug: 'test-article-123',
    content: '<p>Content</p>',
    excerpt: null,
    coverImage: null,
    category: 'news',
    status: 'draft',
    authorId: 'author-uuid-1',
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as News;

describe('NewsService', () => {
  let service: NewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NewsService, { provide: getRepositoryToken(News), useValue: mockRepository }],
    }).compile();

    service = module.get<NewsService>(NewsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findPublished ────────────────────────────────────────────────────────

  describe('findPublished', () => {
    it('returns paginated items', async () => {
      const items = [mockNews({ status: 'published' })];
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([items, 1]);

      const result = await service.findPublished();

      expect(result).toEqual({ items, total: 1 });
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('news');
    });

    it('filters by category when provided', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 0]);

      await service.findPublished('sport');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('news.category = :category', {
        category: 'sport',
      });
    });

    it('returns empty list when no articles', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 0]);

      const result = await service.findPublished();

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  // ── findAllAdmin ─────────────────────────────────────────────────────────

  describe('findAllAdmin', () => {
    it('returns all articles regardless of status', async () => {
      const items = [mockNews(), mockNews({ id: 'news-uuid-2', status: 'published' })];
      mockRepository.findAndCount.mockResolvedValueOnce([items, 2]);

      const result = await service.findAllAdmin();

      expect(result).toEqual({ items, total: 2 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });
  });

  // ── findBySlug ───────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('finds article by slug', async () => {
      const news = mockNews();
      mockRepository.findOne.mockResolvedValueOnce(news);

      const result = await service.findBySlug('test-article-123');

      expect(result).toEqual(news);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: [{ slug: 'test-article-123' }],
      });
    });

    it('finds article by UUID — searches both id and slug', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const news = mockNews();
      mockRepository.findOne.mockResolvedValueOnce(news);

      await service.findBySlug(uuid);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: [{ slug: uuid }, { id: uuid }],
      });
    });

    it('throws NotFoundException when not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findBySlugPublic ─────────────────────────────────────────────────────

  describe('findBySlugPublic', () => {
    it('returns a published article by slug', async () => {
      const news = mockNews({ status: 'published' });
      mockRepository.findOne.mockResolvedValueOnce(news);

      const result = await service.findBySlugPublic('test-article-123');

      expect(result).toEqual(news);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-article-123', status: 'published' },
      });
    });

    it('throws NotFoundException when article is draft', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findBySlugPublic('draft-slug')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when slug does not exist', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findBySlugPublic('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a draft article without publishedAt', async () => {
      const dto = {
        title: 'New Article',
        content: '<p>Hello</p>',
        category: 'news',
        status: 'draft',
      };
      const news = mockNews({ title: dto.title, status: 'draft', publishedAt: null });
      mockRepository.create.mockReturnValueOnce(news);
      mockRepository.save.mockResolvedValueOnce(news);

      const result = await service.create(dto as any, 'author-uuid-1');

      expect(result).toEqual(news);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'author-uuid-1', publishedAt: null }),
      );
    });

    it('sets publishedAt when status is published', async () => {
      const dto = {
        title: 'Published Article',
        content: '<p>Hello</p>',
        category: 'news',
        status: 'published',
      };
      const news = mockNews({ status: 'published', publishedAt: new Date() });
      mockRepository.create.mockReturnValueOnce(news);
      mockRepository.save.mockResolvedValueOnce(news);

      await service.create(dto as any, 'author-uuid-1');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ publishedAt: expect.any(Date) }),
      );
    });

    it('generates slug from title', async () => {
      const dto = {
        title: 'Hello World Article',
        content: '<p>.</p>',
        category: 'news',
        status: 'draft',
      };
      const news = mockNews();
      mockRepository.create.mockReturnValueOnce(news);
      mockRepository.save.mockResolvedValueOnce(news);

      await service.create(dto as any, 'author-uuid-1');

      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.slug).toMatch(/^hello-world-article-\d+$/);
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('allows admin to update any article', async () => {
      const news = mockNews({ authorId: 'other-author' });
      mockRepository.findOne
        .mockResolvedValueOnce(news)
        .mockResolvedValueOnce({ ...news, title: 'Updated' });
      mockRepository.update.mockResolvedValueOnce({ affected: 1 });

      const result = await service.update(
        'news-uuid-1',
        { title: 'Updated' } as any,
        'admin-uuid',
        ['admin'],
      );

      expect(result.title).toBe('Updated');
    });

    it('throws ForbiddenException when editor updates another author article', async () => {
      const news = mockNews({ authorId: 'other-author' });
      mockRepository.findOne.mockResolvedValueOnce(news);

      await expect(
        service.update('news-uuid-1', {} as any, 'editor-uuid', ['editor']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows author to update own article', async () => {
      const news = mockNews({ authorId: 'author-uuid-1' });
      mockRepository.findOne
        .mockResolvedValueOnce(news)
        .mockResolvedValueOnce({ ...news, title: 'My Update' });
      mockRepository.update.mockResolvedValueOnce({ affected: 1 });

      const result = await service.update(
        'news-uuid-1',
        { title: 'My Update' } as any,
        'author-uuid-1',
        ['editor'],
      );

      expect(result.title).toBe('My Update');
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('allows admin to delete any article', async () => {
      const news = mockNews({ authorId: 'other-author' });
      mockRepository.findOne.mockResolvedValueOnce(news);
      mockRepository.delete.mockResolvedValueOnce({ affected: 1 });

      await expect(service.delete('news-uuid-1', 'admin-uuid', ['admin'])).resolves.not.toThrow();
      expect(mockRepository.delete).toHaveBeenCalledWith('news-uuid-1');
    });

    it('throws ForbiddenException when non-owner tries to delete', async () => {
      const news = mockNews({ authorId: 'other-author' });
      mockRepository.findOne.mockResolvedValueOnce(news);

      await expect(service.delete('news-uuid-1', 'random-uuid', ['user'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when article does not exist', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.delete('nonexistent-id', 'admin-uuid', ['admin'])).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
