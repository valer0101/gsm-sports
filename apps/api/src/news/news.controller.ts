import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('news')
@Controller('v1/news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  /* ── Public ── */

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.newsService.findAll(category, 'published', Number(page), Number(limit));
  }

  /* ── Admin ── */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Get('admin/all')
  findAllAdmin(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.newsService.findAllAdmin(Number(page), Number(limit));
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.newsService.findBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Post()
  create(@Body() dto: CreateNewsDto, @Request() req: any) {
    return this.newsService.create(dto, req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNewsDto, @Request() req: any) {
    return this.newsService.update(id, dto, req.user.sub, req.user.roles);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.newsService.delete(id, req.user.sub, req.user.roles);
  }
}
