import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import { UploadController } from './upload.controller';
import { AuthGuard } from '@nestjs/passport';

describe('UploadController', () => {
  let controller: UploadController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UploadController>(UploadController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadImage', () => {
    it('should return url when file is uploaded', () => {
      const mockFile = {
        filename: 'abc123.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      const result = controller.uploadImage(mockFile);
      expect(result).toHaveProperty('url');
      expect(result.url).toContain('abc123.jpg');
      expect(result.url).toContain('/uploads/');
    });

    it('should throw BadRequestException if no file provided', () => {
      expect(() => controller.uploadImage(undefined as any)).toThrow(BadRequestException);
    });

    it('should include base url in response', () => {
      const mockFile = { filename: 'test.png' } as Express.Multer.File;
      const result = controller.uploadImage(mockFile);
      expect(result.url).toMatch(/^https?:\/\//);
    });
  });
});
