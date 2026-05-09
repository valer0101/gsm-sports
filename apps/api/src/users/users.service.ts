import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /** Returns user WITHOUT passwordHash — safe for all non-auth callers */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  /** Returns user WITHOUT passwordHash — safe for all non-auth callers */
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /** Used only by auth service — explicitly selects passwordHash for bcrypt.compare */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  /** Used only by auth service — explicitly selects passwordHash for bcrypt.compare */
  async findByPhoneWithPassword(phone: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.phone = :phone', { phone })
      .getOne();
  }

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<{ users: Omit<User, 'passwordHash'>[]; total: number }> {
    const [users, total] = await this.usersRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 100),
    });
    return {
      users: users.map(({ passwordHash: _ph, ...safe }) => safe as Omit<User, 'passwordHash'>),
      total,
    };
  }

  async updateRoles(id: string, roles: string[]): Promise<User> {
    await this.usersRepository.update(id, { roles });
    return this.findById(id) as Promise<User>;
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    const saved = await this.usersRepository.save(user);
    this.logger.log(`User created: ${saved.email}`);
    return saved;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    return this.findById(id) as Promise<User>;
  }

  /**
   * Self-update for the authenticated user. Applies conversions the controller
   * shouldn't care about (dateOfBirth string → Date, empty avatarUrl → null)
   * and returns a safe projection with passwordHash stripped.
   *
   * The allowlist of writable fields is enforced by UpdateMeDto + the global
   * ValidationPipe({ whitelist: true }) — roles/email/passwordHash can never
   * reach this method via HTTP.
   */
  async updateMe(
    id: string,
    patch: {
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
      country?: string;
      city?: string;
      language?: string;
      dateOfBirth?: string;
    },
  ): Promise<Omit<User, 'passwordHash'>> {
    const data: Partial<User> = {};
    if (patch.firstName !== undefined) data.firstName = patch.firstName;
    if (patch.lastName !== undefined) data.lastName = patch.lastName;
    if (patch.country !== undefined) data.country = patch.country;
    if (patch.city !== undefined) data.city = patch.city;
    if (patch.language !== undefined) data.language = patch.language;
    if (patch.dateOfBirth !== undefined) {
      data.dateOfBirth = patch.dateOfBirth ? new Date(patch.dateOfBirth) : null;
    }
    // Normalise empty string to null so the column matches `string | null`.
    if (patch.avatarUrl !== undefined) {
      data.avatarUrl = patch.avatarUrl && patch.avatarUrl.length > 0 ? patch.avatarUrl : null;
    }

    const updated = await this.update(id, data);
    return this.toSafeUser(updated);
  }

  /** Returns the current user without passwordHash. */
  async findMeSafe(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findById(id);
    if (!user) throw new Error('User not found');
    return this.toSafeUser(user);
  }

  /** Strip the password hash before returning a user to an HTTP caller. */
  private toSafeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _ph, ...safe } = user as User & { passwordHash?: string | null };
    void _ph;
    return safe;
  }

  async seedAdmin(): Promise<void> {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) return;

    const existing = await this.findByEmail(email);
    if (existing) {
      if (!existing.roles.includes('admin')) {
        await this.usersRepository.update(existing.id, { roles: ['admin'] });
        this.logger.log(`Admin role granted to existing user: ${email}`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.create({
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'GSM',
      roles: ['admin'],
      isVerified: true,
    });
    this.logger.log(`Admin user created: ${email}`);
  }
}
