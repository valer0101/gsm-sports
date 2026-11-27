import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { StorageService } from './storage.service';

// Map MIME type to safe extension — never trust client-supplied filename/extension
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/upload')
export class UploadController {
  constructor(private readonly storage: StorageService) {}

  @Post('image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      // Memory storage — file lives in `file.buffer` and gets streamed
      // straight to R2; nothing touches the container disk (Railway
      // wipes it on every redeploy anyway).
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!MIME_TO_EXT[file.mimetype]) {
          return cb(new BadRequestException('Only JPEG, PNG, WebP, GIF images are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    // Re-check on the server side: Multer's fileFilter already guards
    // this, but the boundary check is cheap and protects against a
    // future refactor that loosens the filter.
    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Only JPEG, PNG, WebP, GIF images are allowed');
    }
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException('Upload storage is not configured');
    }
    const key = `${uuidv4()}${ext}`;
    const url = await this.storage.putObject(key, file.buffer, file.mimetype);
    return { url };
  }
}
