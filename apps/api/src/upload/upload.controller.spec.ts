import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { vi } from 'vitest';
import { UploadController } from './upload.controller';
import { StorageService } from './storage.service';
import { AuthGuard } from '@nestjs/passport';

describe('UploadController', () => {
  let controller: UploadController;
  let storage: { isConfigured: ReturnType<typeof vi.fn>; putObject: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    storage = {
      isConfigured: vi.fn().mockReturnValue(true),
      putObject: vi.fn().mockResolvedValue('https://uploads.gsmarm.com/abc.jpg'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [{ provide: StorageService, useValue: storage }],
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
    const mockFile = (overrides: Partial<Express.Multer.File> = {}) =>
      ({
        fieldname: 'file',
        originalname: 'photo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('binary'),
        ...overrides,
      }) as Express.Multer.File;

    it('returns the R2 URL after uploading', async () => {
      const result = await controller.uploadImage(mockFile());
      expect(result).toEqual({ url: 'https://uploads.gsmarm.com/abc.jpg' });
      expect(storage.putObject).toHaveBeenCalledTimes(1);
      const [key, body, contentType] = storage.putObject.mock.calls[0];
      expect(key).toMatch(/^[0-9a-f-]{36}\.jpg$/);
      expect(body).toBeInstanceOf(Buffer);
      expect(contentType).toBe('image/jpeg');
    });

    it('maps MIME types to safe extensions (webp)', async () => {
      await controller.uploadImage(mockFile({ mimetype: 'image/webp' }));
      const [key] = storage.putObject.mock.calls[0];
      expect(key.endsWith('.webp')).toBe(true);
    });

    it('throws BadRequestException if no file provided', async () => {
      await expect(controller.uploadImage(undefined as unknown as Express.Multer.File)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects unsupported MIME types', async () => {
      await expect(controller.uploadImage(mockFile({ mimetype: 'application/pdf' }))).rejects.toThrow(
        BadRequestException,
      );
      expect(storage.putObject).not.toHaveBeenCalled();
    });

    it('returns 503 when storage is not configured', async () => {
      storage.isConfigured.mockReturnValue(false);
      await expect(controller.uploadImage(mockFile())).rejects.toThrow(ServiceUnavailableException);
      expect(storage.putObject).not.toHaveBeenCalled();
    });
  });
});
