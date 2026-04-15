import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { News } from './entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

@Injectable()
export class NewsService {
  private logger = new Logger(NewsService.name);

  constructor(
    @InjectRepository(News)
    private readonly newsRepository: Repository<News>,
  ) {}

  async findAll(category?: string, status = 'published', page = 1, limit = 20) {
    const qb = this.newsRepository
      .createQueryBuilder('news')
      .orderBy('news.publishedAt', 'DESC')
      .addOrderBy('news.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(Math.min(limit, 100));

    if (category) qb.andWhere('news.category = :category', { category });
    if (status) qb.andWhere('news.status = :status', { status });

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findAllAdmin(page = 1, limit = 20) {
    const [items, total] = await this.newsRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 100),
    });
    return { items, total };
  }

  async findBySlug(slugOrId: string): Promise<News> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
    const where = isUuid ? [{ slug: slugOrId }, { id: slugOrId }] : [{ slug: slugOrId }];
    const news = await this.newsRepository.findOne({ where });
    if (!news) throw new NotFoundException('Article not found');
    return news;
  }

  async findById(id: string): Promise<News> {
    const news = await this.newsRepository.findOne({ where: { id } });
    if (!news) throw new NotFoundException('Article not found');
    return news;
  }

  async create(dto: CreateNewsDto, authorId: string): Promise<News> {
    const slug = this.slugify(dto.title) + '-' + Date.now();
    const news = this.newsRepository.create({
      ...dto,
      slug,
      authorId,
      publishedAt: dto.status === 'published' ? new Date() : null,
    });
    const saved = await this.newsRepository.save(news);
    this.logger.log(`News created: ${saved.id} by ${authorId}`);
    return saved;
  }

  async update(id: string, dto: UpdateNewsDto, userId: string, userRoles: string[]): Promise<News> {
    const news = await this.findById(id);
    const isAdmin = userRoles.includes('admin');
    if (!isAdmin && news.authorId !== userId) throw new ForbiddenException('Access denied');

    const wasPublished = news.status === 'published';
    const willPublish = dto.status === 'published';

    await this.newsRepository.update(id, {
      ...dto,
      publishedAt: !wasPublished && willPublish ? new Date() : news.publishedAt,
    });
    return this.findById(id);
  }

  async delete(id: string, userId: string, userRoles: string[]): Promise<void> {
    const news = await this.findById(id);
    const isAdmin = userRoles.includes('admin');
    if (!isAdmin && news.authorId !== userId) throw new ForbiddenException('Access denied');
    await this.newsRepository.delete(id);
    this.logger.log(`News deleted: ${id}`);
  }

  private slugify(text: string): string {
    const base = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
    return base || 'article';
  }
}
