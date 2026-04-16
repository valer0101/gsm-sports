import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

const mockRepository = {
  findOne: vi.fn(),
  findAndCount: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
};

const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    email: 'test@gsm.com',
    passwordHash: '$2b$12$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    roles: ['user'],
    isActive: true,
    isVerified: false,
    phone: null,
    avatarUrl: null,
    googleId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: mockRepository }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findByEmail ───────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('returns user when found', async () => {
      const user = mockUser();
      mockRepository.findOne.mockResolvedValueOnce(user);

      const result = await service.findByEmail('test@gsm.com');

      expect(result).toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { email: 'test@gsm.com' } });
    });

    it('returns null when not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.findByEmail('unknown@gsm.com');

      expect(result).toBeNull();
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns user when found', async () => {
      const user = mockUser();
      mockRepository.findOne.mockResolvedValueOnce(user);

      const result = await service.findById('user-uuid-1');

      expect(result).toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-uuid-1' } });
    });

    it('returns null when not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated users without passwordHash', async () => {
      const users = [mockUser(), mockUser({ id: 'user-uuid-2', email: 'b@gsm.com' })];
      mockRepository.findAndCount.mockResolvedValueOnce([users, 2]);

      const result = await service.findAll();

      expect(result.total).toBe(2);
      expect(result.users).toHaveLength(2);
      // passwordHash must be stripped from the response
      result.users.forEach((u) => {
        expect(u).not.toHaveProperty('passwordHash');
      });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });

    it('respects page and limit params', async () => {
      mockRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      await service.findAll(2, 10);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('caps limit at 100', async () => {
      mockRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      await service.findAll(1, 200);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ── updateRoles ───────────────────────────────────────────────────────────

  describe('updateRoles', () => {
    it('updates roles and returns updated user', async () => {
      const updatedUser = mockUser({ roles: ['user', 'organizer'] });
      mockRepository.update.mockResolvedValueOnce({ affected: 1 });
      mockRepository.findOne.mockResolvedValueOnce(updatedUser);

      const result = await service.updateRoles('user-uuid-1', ['user', 'organizer']);

      expect(mockRepository.update).toHaveBeenCalledWith('user-uuid-1', {
        roles: ['user', 'organizer'],
      });
      expect(result.roles).toEqual(['user', 'organizer']);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and returns a new user', async () => {
      const userData = {
        email: 'new@gsm.com',
        firstName: 'New',
        lastName: 'User',
        passwordHash: 'hash',
      };
      const user = mockUser(userData);
      mockRepository.create.mockReturnValueOnce(user);
      mockRepository.save.mockResolvedValueOnce(user);

      const result = await service.create(userData);

      expect(result).toEqual(user);
      expect(mockRepository.create).toHaveBeenCalledWith(userData);
      expect(mockRepository.save).toHaveBeenCalledWith(user);
    });
  });

  // ── seedAdmin ─────────────────────────────────────────────────────────────

  describe('seedAdmin', () => {
    it('does nothing when env vars are missing', async () => {
      await service.seedAdmin();

      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });

    it('creates admin when not exists', async () => {
      process.env.ADMIN_EMAIL = 'admin@gsm.com';
      process.env.ADMIN_PASSWORD = 'Admin1234!';
      mockRepository.findOne.mockResolvedValueOnce(null);
      const adminUser = mockUser({ email: 'admin@gsm.com', roles: ['admin'] });
      mockRepository.create.mockReturnValueOnce(adminUser);
      mockRepository.save.mockResolvedValueOnce(adminUser);

      await service.seedAdmin();

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'admin@gsm.com', roles: ['admin'] }),
      );
    });

    it('updates existing user to admin role', async () => {
      process.env.ADMIN_EMAIL = 'admin@gsm.com';
      process.env.ADMIN_PASSWORD = 'Admin1234!';
      const existingUser = mockUser({ email: 'admin@gsm.com', roles: ['user'] });
      mockRepository.findOne.mockResolvedValueOnce(existingUser);
      mockRepository.update.mockResolvedValueOnce({ affected: 1 });

      await service.seedAdmin();

      expect(mockRepository.update).toHaveBeenCalledWith(
        existingUser.id,
        expect.objectContaining({ roles: ['admin'] }),
      );
    });

    it('does not call update if user is already admin (no password overwrite)', async () => {
      process.env.ADMIN_EMAIL = 'admin@gsm.com';
      process.env.ADMIN_PASSWORD = 'Admin1234!';
      const existingAdmin = mockUser({ email: 'admin@gsm.com', roles: ['admin'] });
      mockRepository.findOne.mockResolvedValueOnce(existingAdmin);

      await service.seedAdmin();

      // Password is NOT overwritten on restart — update is not called at all
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });
});
