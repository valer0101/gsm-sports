# Production Launch Week — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all code workstreams required for the full public launch per the spec at `docs/superpowers/specs/2026-05-20-production-launch-week-design.md` — mail (Resend), password reset, email verification (soft gate), deploy config, migrations-on-deploy, off-platform backups, uptime monitoring runbooks, Sentry verification, and STATUS/ROADMAP refresh.

**Architecture:** Each workstream is a self-contained set of files following existing project conventions (NestJS modules with controller/service/dto/entities + TypeORM migrations + Vitest specs on the API; Next.js App Router pages + next-intl + React Query + RHF/Zod on the web). Token tables for reset/verification use SHA-256 hashes of high-entropy random tokens (no bcrypt — they are already high-entropy single-use). Mail templates are inline trilingual strings selected by user locale. Deploy is push-to-`main` via Railway's and Vercel's native GitHub integration (no custom GHA deploy job); migrations run as Railway's pre-deploy command.

**Tech Stack:** TypeScript, NestJS 11, TypeORM, PostgreSQL, Vitest, class-validator, `resend` SDK; Next.js 15, React 19, next-intl, @tanstack/react-query, react-hook-form + zod; GitHub Actions, AWS S3 SDK targeting Cloudflare R2.

---

## Conventions used in this plan

- **Migration timestamps** start at `1779580000000` and increment by `100000000`. The latest existing migration is `1779196949608` (see `apps/api/src/migrations/`), so any value above that works; staying monotonically increasing keeps them ordered.
- **Test command for one file:**  `cd apps/api && npx vitest run path/to/file.spec.ts` (or `cd apps/web && npx vitest run …`).
- **Commit messages** follow project convention `<type>(<scope>): <description>` per CLAUDE.md (`type` in `feat|fix|chore|refactor|docs|test`; scopes `api|web|db|auth|ci|i18n|docs`).
- **Frequent commits:** every task ends with a commit. Tests must pass before committing.
- **No `console.log`**: use `private logger = new Logger(ClassName.name)` per CLAUDE.md.

---

## Workstream A — Mail module (Resend)

### Task 1: Add `resend` dependency and stub MailService

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/mail/mail.module.ts`
- Create: `apps/api/src/mail/mail.service.ts`
- Test: `apps/api/src/mail/mail.service.spec.ts`

- [ ] **Step 1: Add `resend` to api dependencies**

In `apps/api/package.json`, add `"resend": "^4.0.0"` inside `"dependencies"` (alphabetically — between `@sentry/...` and other deps). Then run from repo root:

```bash
npm install --workspace=@gsm/api resend@^4.0.0
```

Expected: `package-lock.json` updated, no errors.

- [ ] **Step 2: Write failing test for MailService**

Create `apps/api/src/mail/mail.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailService } from './mail.service';

const sendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

async function buildService(env: Partial<Record<string, string>>): Promise<MailService> {
  const config = {
    get: vi.fn((key: string) => env[key]),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [MailService, { provide: ConfigService, useValue: config }],
  }).compile();
  return module.get(MailService);
}

describe('MailService', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
  });

  it('is disabled when RESEND_API_KEY is not set and does not throw', async () => {
    const service = await buildService({ MAIL_FROM: 'no-reply@gsm-sports.example' });
    await service.send({ to: 'aram@example.com', subject: 's', html: '<p>x</p>' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends via Resend when configured', async () => {
    const service = await buildService({
      RESEND_API_KEY: 're_test_key',
      MAIL_FROM: 'GSM <no-reply@gsm-sports.example>',
    });
    await service.send({ to: 'aram@example.com', subject: 'Hello', html: '<p>x</p>' });
    expect(sendMock).toHaveBeenCalledWith({
      from: 'GSM <no-reply@gsm-sports.example>',
      to: 'aram@example.com',
      subject: 'Hello',
      html: '<p>x</p>',
    });
  });

  it('logs and swallows Resend errors so a transient mail failure does not 500 the caller', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'rate limited' } });
    const service = await buildService({
      RESEND_API_KEY: 're_test_key',
      MAIL_FROM: 'no-reply@gsm-sports.example',
    });
    await expect(
      service.send({ to: 'aram@example.com', subject: 's', html: '<p>x</p>' }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Verify the test fails**

Run: `cd apps/api && npx vitest run src/mail/mail.service.spec.ts`
Expected: FAIL (cannot find module `./mail.service`).

- [ ] **Step 4: Implement MailService**

Create `apps/api/src/mail/mail.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Thin wrapper over the Resend SDK. Mirrors the Sentry pattern: when
 * RESEND_API_KEY is unset the service short-circuits to a no-op + log
 * line so local dev and CI don't need real credentials, and a single
 * missing env var doesn't crash the app at boot.
 *
 * Errors from Resend are logged at warn level but never rethrown — a
 * transient mail outage must not 500 a sign-up or forgot-password
 * request. The user can always retry; the audit trail lives in logs.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('MAIL_FROM') ?? 'no-reply@gsm-sports.example';
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY not set — MailService is disabled. Outbound email will be logged but not sent.',
      );
      this.client = null;
    } else {
      this.client = new Resend(apiKey);
    }
  }

  async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.client) {
      this.logger.log(`[mail disabled] would send to=${opts.to} subject="${opts.subject}"`);
      return;
    }
    try {
      const { error } = await this.client.emails.send({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      if (error) {
        this.logger.warn(`Resend rejected email to=${opts.to}: ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(
        `Resend threw for email to=${opts.to}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
```

- [ ] **Step 5: Verify test passes**

Run: `cd apps/api && npx vitest run src/mail/mail.service.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Create MailModule**

Create `apps/api/src/mail/mail.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/src/mail/ package-lock.json
git commit -m "feat(api): add Resend mail service with no-op fallback"
```

---

### Task 2: Trilingual email templates

**Files:**
- Create: `apps/api/src/mail/templates/password-reset.ts`
- Create: `apps/api/src/mail/templates/email-verification.ts`
- Create: `apps/api/src/mail/templates/index.ts`
- Test: `apps/api/src/mail/templates/templates.spec.ts`

- [ ] **Step 1: Write failing test for template renderers**

Create `apps/api/src/mail/templates/templates.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderPasswordResetEmail, renderVerificationEmail } from './index';

describe('email templates', () => {
  it('renders password reset email in Russian by default', () => {
    const out = renderPasswordResetEmail({
      locale: 'ru',
      resetUrl: 'https://gsm.example/auth/reset-password?token=abc',
      firstName: 'Арам',
    });
    expect(out.subject).toMatch(/пароля/i);
    expect(out.html).toContain('https://gsm.example/auth/reset-password?token=abc');
    expect(out.html).toContain('Арам');
  });

  it('renders password reset email in English', () => {
    const out = renderPasswordResetEmail({
      locale: 'en',
      resetUrl: 'https://gsm.example/auth/reset-password?token=abc',
      firstName: 'Aram',
    });
    expect(out.subject.toLowerCase()).toContain('password');
  });

  it('renders password reset email in Armenian', () => {
    const out = renderPasswordResetEmail({
      locale: 'hy',
      resetUrl: 'https://gsm.example/auth/reset-password?token=abc',
      firstName: 'Արամ',
    });
    expect(out.subject).toMatch(/գաղտնաբառ/i);
  });

  it('falls back to hy for unknown locale', () => {
    const out = renderPasswordResetEmail({
      // @ts-expect-error — testing fallback for an unsupported locale
      locale: 'fr',
      resetUrl: 'https://gsm.example/x',
      firstName: 'Aram',
    });
    expect(out.subject).toMatch(/գաղտնաբառ/i);
  });

  it('renders verification email containing the verify URL', () => {
    const out = renderVerificationEmail({
      locale: 'en',
      verifyUrl: 'https://gsm.example/auth/verify-email?token=xyz',
      firstName: 'Aram',
    });
    expect(out.html).toContain('https://gsm.example/auth/verify-email?token=xyz');
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `cd apps/api && npx vitest run src/mail/templates/templates.spec.ts`
Expected: FAIL (cannot find module `./index`).

- [ ] **Step 3: Create the password-reset template**

Create `apps/api/src/mail/templates/password-reset.ts`:

```ts
export type SupportedLocale = 'ru' | 'en' | 'hy';

export interface PasswordResetParams {
  locale: SupportedLocale;
  resetUrl: string;
  firstName: string;
}

const subjects: Record<SupportedLocale, string> = {
  ru: 'Сброс пароля GSM Sports',
  en: 'Reset your GSM Sports password',
  hy: 'GSM Sports գաղտնաբառի վերականգնում',
};

const greetings: Record<SupportedLocale, (name: string) => string> = {
  ru: (n) => `Здравствуйте, ${n}!`,
  en: (n) => `Hi ${n},`,
  hy: (n) => `Բարև, ${n}։`,
};

const bodies: Record<SupportedLocale, (url: string) => string> = {
  ru: (url) => `
    <p>Вы запросили сброс пароля. Перейдите по ссылке, чтобы задать новый пароль:</p>
    <p><a href="${url}">${url}</a></p>
    <p>Ссылка действует 30 минут. Если вы не запрашивали сброс — просто проигнорируйте письмо.</p>`,
  en: (url) => `
    <p>You requested a password reset. Click the link below to set a new password:</p>
    <p><a href="${url}">${url}</a></p>
    <p>This link is valid for 30 minutes. If you didn't request a reset, you can ignore this email.</p>`,
  hy: (url) => `
    <p>Դուք պահանջել եք գաղտնաբառի վերականգնում։ Սեղմեք հղման վրա՝ նոր գաղտնաբառ սահմանելու համար.</p>
    <p><a href="${url}">${url}</a></p>
    <p>Հղումը գործում է 30 րոպե։ Եթե դուք չեք պահանջել վերականգնում, պարզապես անտեսեք նամակը։</p>`,
};

export function renderPasswordReset(p: PasswordResetParams): { subject: string; html: string } {
  const locale: SupportedLocale = (['ru', 'en', 'hy'] as const).includes(p.locale) ? p.locale : 'hy';
  return {
    subject: subjects[locale],
    html: `${greetings[locale](p.firstName)}\n${bodies[locale](p.resetUrl)}`,
  };
}
```

- [ ] **Step 4: Create the verification template**

Create `apps/api/src/mail/templates/email-verification.ts`:

```ts
export type SupportedLocale = 'ru' | 'en' | 'hy';

export interface VerificationParams {
  locale: SupportedLocale;
  verifyUrl: string;
  firstName: string;
}

const subjects: Record<SupportedLocale, string> = {
  ru: 'Подтвердите email на GSM Sports',
  en: 'Verify your GSM Sports email',
  hy: 'Հաստատեք ձեր էլ. փոստը GSM Sports-ում',
};

const greetings: Record<SupportedLocale, (name: string) => string> = {
  ru: (n) => `Здравствуйте, ${n}!`,
  en: (n) => `Hi ${n},`,
  hy: (n) => `Բարև, ${n}։`,
};

const bodies: Record<SupportedLocale, (url: string) => string> = {
  ru: (url) => `
    <p>Спасибо за регистрацию! Подтвердите email, чтобы получать уведомления о турнирах:</p>
    <p><a href="${url}">${url}</a></p>
    <p>Ссылка действует 24 часа.</p>`,
  en: (url) => `
    <p>Thanks for signing up! Verify your email to receive tournament notifications:</p>
    <p><a href="${url}">${url}</a></p>
    <p>This link is valid for 24 hours.</p>`,
  hy: (url) => `
    <p>Շնորհակալություն գրանցման համար։ Հաստատեք ձեր էլ. փոստը՝ մրցույթների ծանուցումներ ստանալու համար.</p>
    <p><a href="${url}">${url}</a></p>
    <p>Հղումը գործում է 24 ժամ։</p>`,
};

export function renderEmailVerification(p: VerificationParams): { subject: string; html: string } {
  const locale: SupportedLocale = (['ru', 'en', 'hy'] as const).includes(p.locale) ? p.locale : 'hy';
  return {
    subject: subjects[locale],
    html: `${greetings[locale](p.firstName)}\n${bodies[locale](p.verifyUrl)}`,
  };
}
```

- [ ] **Step 5: Create the index re-export**

Create `apps/api/src/mail/templates/index.ts`:

```ts
export {
  renderPasswordReset as renderPasswordResetEmail,
  type PasswordResetParams,
  type SupportedLocale,
} from './password-reset';
export {
  renderEmailVerification as renderVerificationEmail,
  type VerificationParams,
} from './email-verification';
```

- [ ] **Step 6: Verify tests pass**

Run: `cd apps/api && npx vitest run src/mail/templates/templates.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/mail/templates/
git commit -m "feat(api): trilingual email templates for reset and verification"
```

---

## Workstream B — Password reset (backend)

### Task 3: Password-reset-token entity and migration

**Files:**
- Create: `apps/api/src/auth/entities/password-reset-token.entity.ts`
- Create: `apps/api/src/migrations/1779580000000-password-reset-tokens.ts`
- Modify: `apps/api/src/data-source.ts`

- [ ] **Step 1: Create the entity**

Create `apps/api/src/auth/entities/password-reset-token.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  // SHA-256 hex of the random token. Hex of a 32-byte digest is 64 chars.
  // The plaintext token lives only in the email link, never in the DB.
  @Index()
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 2: Create the migration**

Create `apps/api/src/migrations/1779580000000-password-reset-tokens.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `password_reset_tokens` — single-use, time-limited tokens for the
 * forgot-password flow. Token is stored hashed (SHA-256 hex), plaintext
 * only ever in the outgoing email. `ON DELETE CASCADE` on user_id keeps
 * the table cleaner after a user deletion.
 */
export class PasswordResetTokens1779580000000 implements MigrationInterface {
  name = 'PasswordResetTokens1779580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_password_reset_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_user_id"
        ON "password_reset_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_token_hash"
        ON "password_reset_tokens" ("token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_password_reset_tokens_token_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_password_reset_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
  }
}
```

- [ ] **Step 3: Register the entity in `data-source.ts`**

In `apps/api/src/data-source.ts`, add the import near the other entity imports and the entity in the `entities: [...]` array.

```ts
// near the top with other imports
import { PasswordResetToken } from './auth/entities/password-reset-token.entity';
```

```ts
// inside the entities array, after News:
News,
PasswordResetToken,
TelegramLink,
```

- [ ] **Step 4: Sanity-check the migration syntactically**

Run: `cd apps/api && npm run build`
Expected: TypeScript build succeeds (no compile errors from the new files).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/entities/password-reset-token.entity.ts apps/api/src/migrations/1779580000000-password-reset-tokens.ts apps/api/src/data-source.ts
git commit -m "feat(db): add password_reset_tokens table"
```

---

### Task 4: PasswordResetService — request flow

**Files:**
- Create: `apps/api/src/auth/password-reset.service.ts`
- Test: `apps/api/src/auth/password-reset.service.spec.ts`

- [ ] **Step 1: Write failing tests for `requestReset`**

Create `apps/api/src/auth/password-reset.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Repository } from 'typeorm';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import type { User } from '../users/entities/user.entity';

const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'aram@example.com',
    firstName: 'Aram',
    lastName: 'X',
    roles: ['user'],
    language: 'en',
    isVerified: false,
    isActive: true,
    phone: null,
    avatarUrl: null,
    googleId: null,
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

interface Mocks {
  users: { findByEmail: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; findByIdWithPassword: ReturnType<typeof vi.fn> };
  mail: { send: ReturnType<typeof vi.fn> };
  repo: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  config: { get: ReturnType<typeof vi.fn> };
}

async function buildService(): Promise<{ service: PasswordResetService; mocks: Mocks }> {
  const mocks: Mocks = {
    users: { findByEmail: vi.fn(), update: vi.fn(), findByIdWithPassword: vi.fn() },
    mail: { send: vi.fn().mockResolvedValue(undefined) },
    repo: { create: vi.fn((x) => x), save: vi.fn(), findOne: vi.fn(), update: vi.fn() },
    config: { get: vi.fn((k: string) => (k === 'NEXT_PUBLIC_SITE_URL' ? 'https://gsm.example' : undefined)) },
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PasswordResetService,
      { provide: getRepositoryToken(PasswordResetToken), useValue: mocks.repo },
      { provide: UsersService, useValue: mocks.users },
      { provide: MailService, useValue: mocks.mail },
      { provide: ConfigService, useValue: mocks.config },
    ],
  }).compile();
  return { service: module.get(PasswordResetService), mocks };
}

describe('PasswordResetService.requestReset', () => {
  let service: PasswordResetService;
  let mocks: Mocks;

  beforeEach(async () => {
    ({ service, mocks } = await buildService());
  });

  it('silently returns success when no user matches the email', async () => {
    mocks.users.findByEmail.mockResolvedValue(null);
    await expect(service.requestReset('nobody@example.com')).resolves.toBeUndefined();
    expect(mocks.repo.save).not.toHaveBeenCalled();
    expect(mocks.mail.send).not.toHaveBeenCalled();
  });

  it('saves a hashed token and sends an email when the user exists', async () => {
    mocks.users.findByEmail.mockResolvedValue(mockUser());
    mocks.repo.save.mockResolvedValue({ id: 'tok-1' });

    await service.requestReset('aram@example.com');

    expect(mocks.repo.save).toHaveBeenCalledTimes(1);
    const savedRow = mocks.repo.save.mock.calls[0][0];
    expect(savedRow.userId).toBe('user-1');
    expect(savedRow.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(savedRow.expiresAt).toBeInstanceOf(Date);

    expect(mocks.mail.send).toHaveBeenCalledTimes(1);
    const sent = mocks.mail.send.mock.calls[0][0];
    expect(sent.to).toBe('aram@example.com');
    expect(sent.html).toMatch(/https:\/\/gsm\.example\/auth\/reset-password\?token=[a-f0-9]{64}/);
    // The raw token in the URL must NOT equal the stored hash.
    const urlToken = sent.html.match(/token=([a-f0-9]{64})/)![1];
    expect(urlToken).not.toBe(savedRow.tokenHash);
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `cd apps/api && npx vitest run src/auth/password-reset.service.spec.ts`
Expected: FAIL (cannot find module `./password-reset.service`).

- [ ] **Step 3: Implement the service (request path only)**

Create `apps/api/src/auth/password-reset.service.ts`:

```ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { renderPasswordResetEmail, type SupportedLocale } from '../mail/templates';

const TOKEN_BYTES = 32;
const TOKEN_TTL_MINUTES = 30;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokens: Repository<PasswordResetToken>,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Step 1 of the flow: user submits their email. We ALWAYS resolve
   * without error — never reveal whether the address exists. If a real
   * user is found we save a hashed token and email the plaintext.
   */
  async requestReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      // Silently succeed; log at debug for forensics only.
      this.logger.debug(`Password reset requested for unknown email: ${email}`);
      return;
    }

    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

    await this.tokens.save(
      this.tokens.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null,
      }),
    );

    const siteUrl = this.config.get<string>('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000';
    const resetUrl = `${siteUrl}/auth/reset-password?token=${rawToken}`;
    const locale = (user.language as SupportedLocale) ?? 'hy';

    const { subject, html } = renderPasswordResetEmail({
      locale,
      resetUrl,
      firstName: user.firstName,
    });
    await this.mail.send({ to: user.email, subject, html });
    this.logger.log(`Password reset requested for ${user.email}`);
  }

  // consumeToken is implemented in Task 5 — keep the stub here to keep
  // the controller's import shape stable.
  async consumeToken(_rawToken: string, _newPassword: string): Promise<void> {
    throw new BadRequestException('Not implemented yet');
  }
}

export const __testing = { TOKEN_BYTES, TOKEN_TTL_MINUTES };
// Suppress unused import — bcrypt is needed in Task 5 but importing it now
// avoids touching this file again to add it; ts-eslint allows unused imports
// when re-exported elsewhere, so we no-op it.
void bcrypt;
void LessThan;
```

- [ ] **Step 4: Verify tests pass**

Run: `cd apps/api && npx vitest run src/auth/password-reset.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/password-reset.service.ts apps/api/src/auth/password-reset.service.spec.ts
git commit -m "feat(auth): password reset request flow with hashed tokens"
```

---

### Task 5: PasswordResetService — consume flow

**Files:**
- Modify: `apps/api/src/auth/password-reset.service.ts`
- Modify: `apps/api/src/auth/password-reset.service.spec.ts`

- [ ] **Step 1: Append failing tests for `consumeToken`**

Append to `apps/api/src/auth/password-reset.service.spec.ts` (after the existing `describe` block):

```ts
import * as crypto from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

describe('PasswordResetService.consumeToken', () => {
  let service: PasswordResetService;
  let mocks: Mocks;

  beforeEach(async () => {
    ({ service, mocks } = await buildService());
  });

  function hash(t: string) {
    return crypto.createHash('sha256').update(t).digest('hex');
  }

  it('throws on unknown / expired / used token', async () => {
    mocks.repo.findOne.mockResolvedValue(null);
    await expect(service.consumeToken('badtoken', 'newpassword12')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updates password and marks token used on success', async () => {
    const raw = 'a'.repeat(64);
    const row = {
      id: 'tok-1',
      userId: 'user-1',
      tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + 10_000),
      usedAt: null,
    };
    mocks.repo.findOne.mockResolvedValue(row);

    await service.consumeToken(raw, 'newPassword12');

    expect(mocks.users.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ passwordHash: expect.any(String) }),
    );
    // bcrypt hash starts with $2
    expect((mocks.users.update.mock.calls[0][1] as any).passwordHash).toMatch(/^\$2[aby]\$/);
    expect(mocks.repo.update).toHaveBeenCalledWith(
      { id: 'tok-1' },
      expect.objectContaining({ usedAt: expect.any(Date) }),
    );
  });

  it('refuses passwords shorter than 8 chars (defense in depth — DTO also enforces)', async () => {
    const raw = 'b'.repeat(64);
    mocks.repo.findOne.mockResolvedValue({
      id: 'tok-2',
      userId: 'user-1',
      tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + 10_000),
      usedAt: null,
    });
    await expect(service.consumeToken(raw, 'short')).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.users.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify the new tests fail**

Run: `cd apps/api && npx vitest run src/auth/password-reset.service.spec.ts`
Expected: FAIL (3 new tests fail — current stub always throws "Not implemented yet").

- [ ] **Step 3: Implement `consumeToken`**

In `apps/api/src/auth/password-reset.service.ts`, replace the stubbed `consumeToken` method with:

```ts
  /**
   * Step 2 of the flow: user submits the token + a new password.
   * Verifies the token (unused, unexpired), sets the password, marks
   * the token used.
   *
   * Session-invalidation note: existing access-token cookies expire in
   * 15 minutes regardless (see `JwtModule.registerAsync` in
   * `auth.module.ts`); refresh tokens are issued but not currently
   * persisted client-side. Effective session invalidation therefore
   * happens within 15 minutes of a reset without further code. A
   * passwordChangedAt column + JwtStrategy DB check is a post-launch
   * tightening (see ROADMAP — Phase 2 / Security).
   */
  async consumeToken(rawToken: string, newPassword: string): Promise<void> {
    if (typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/.test(rawToken)) {
      throw new BadRequestException('Invalid reset token');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const row = await this.tokens.findOne({
      where: { tokenHash, usedAt: null as unknown as Date },
    });

    if (!row || row.usedAt !== null || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.users.update(row.userId, { passwordHash });
    await this.tokens.update({ id: row.id }, { usedAt: new Date() });
    this.logger.log(`Password reset consumed for userId=${row.userId}`);
  }
```

Also remove the stray `void bcrypt; void LessThan;` lines from Task 4 — they were placeholders to avoid an unused-import lint error until this task implemented them. `LessThan` is still unused; remove that import as well.

After edits, the imports at the top should read:

```ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { renderPasswordResetEmail, type SupportedLocale } from '../mail/templates';
```

- [ ] **Step 4: Verify all tests pass**

Run: `cd apps/api && npx vitest run src/auth/password-reset.service.spec.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/password-reset.service.ts apps/api/src/auth/password-reset.service.spec.ts
git commit -m "feat(auth): password reset consume flow updates user password"
```

---

### Task 6: Auth controller endpoints + module wiring

**Files:**
- Create: `apps/api/src/auth/dto/forgot-password.dto.ts`
- Create: `apps/api/src/auth/dto/reset-password.dto.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/auth/auth.controller.spec.ts`

- [ ] **Step 1: Create the DTOs**

Create `apps/api/src/auth/dto/forgot-password.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}
```

Create `apps/api/src/auth/dto/reset-password.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Hex token from the email link', example: 'a'.repeat(64) })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Invalid reset token format' })
  token: string;

  @ApiProperty({ example: 'NewSecurePass123' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}
```

- [ ] **Step 2: Add a failing controller test**

Open `apps/api/src/auth/auth.controller.spec.ts`. At the bottom of the file, append a new describe block. (The existing spec already constructs a controller with mocked services — re-use that style; if the existing build helper does not accept a `PasswordResetService` mock, extend it in Step 3 first.)

```ts
import { PasswordResetService } from './password-reset.service';

describe('AuthController password reset', () => {
  it('POST /v1/auth/forgot-password calls service and always returns 200', async () => {
    const reset = { requestReset: vi.fn().mockResolvedValue(undefined), consumeToken: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: OAuthStateService, useValue: {} },
        { provide: PasswordResetService, useValue: reset },
      ],
    }).compile();
    const controller = moduleRef.get(AuthController);
    const result = await controller.forgotPassword({ email: 'aram@example.com' });
    expect(reset.requestReset).toHaveBeenCalledWith('aram@example.com');
    expect(result).toEqual({ message: expect.any(String) });
  });

  it('POST /v1/auth/reset-password delegates to consumeToken', async () => {
    const reset = { requestReset: vi.fn(), consumeToken: vi.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: OAuthStateService, useValue: {} },
        { provide: PasswordResetService, useValue: reset },
      ],
    }).compile();
    const controller = moduleRef.get(AuthController);
    await controller.resetPassword({ token: 'a'.repeat(64), password: 'newPass123' });
    expect(reset.consumeToken).toHaveBeenCalledWith('a'.repeat(64), 'newPass123');
  });
});
```

You may need to add the imports (`AuthController`, `AuthService`, `ConfigService`, `OAuthStateService`, `Test`, `vi`, `describe`, `it`, `expect`) at the top of the file if they are not already imported there.

- [ ] **Step 3: Verify the test fails**

Run: `cd apps/api && npx vitest run src/auth/auth.controller.spec.ts`
Expected: FAIL (`forgotPassword`/`resetPassword` not on controller).

- [ ] **Step 4: Add controller endpoints**

In `apps/api/src/auth/auth.controller.ts`:

1. Add imports at the top:

```ts
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetService } from './password-reset.service';
```

2. Inject `PasswordResetService` into the constructor:

```ts
constructor(
  private readonly authService: AuthService,
  private readonly configService: ConfigService,
  private readonly oauthState: OAuthStateService,
  private readonly passwordReset: PasswordResetService,
) {}
```

3. Add the two endpoints (place them above the `// ── Google OAuth ──` divider so password endpoints stay grouped):

```ts
  /**
   * Always returns 200, even when no user matches. Anti-enumeration.
   * Rate-limited per existing /auth/* policy (10 req / 15 min / IP).
   */
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordReset.requestReset(dto.email);
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  /**
   * Consumes a reset token + sets the new password. The token format and
   * password length are also enforced by the DTO so invalid input is
   * rejected before any DB work.
   */
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordReset.consumeToken(dto.token, dto.password);
    return { message: 'Password updated' };
  }
```

- [ ] **Step 5: Wire the service into AuthModule**

In `apps/api/src/auth/auth.module.ts`:

1. Add imports:

```ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { PasswordResetService } from './password-reset.service';
import { MailModule } from '../mail/mail.module';
```

2. Add to `imports`:

```ts
imports: [
  UsersModule,
  MailModule,
  TypeOrmModule.forFeature([PasswordResetToken]),
  PassportModule.register({ defaultStrategy: 'jwt' }),
  // ...keep existing JwtModule.registerAsync(...)
],
```

3. Add to `providers`:

```ts
providers: [
  AuthService,
  PasswordResetService,
  JwtStrategy,
  OAuthStateService,
  GoogleAuthGuard,
  ...googleStrategyProviders(),
],
```

- [ ] **Step 6: Verify all auth tests pass**

Run: `cd apps/api && npx vitest run src/auth/`
Expected: PASS (all existing + the two new controller tests).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/auth/
git commit -m "feat(auth): /v1/auth/forgot-password and /v1/auth/reset-password endpoints"
```

---

## Workstream C — Email verification (backend, soft gate)

### Task 7: Email-verification-token entity and migration

**Files:**
- Create: `apps/api/src/auth/entities/email-verification-token.entity.ts`
- Create: `apps/api/src/migrations/1779680000000-email-verification-tokens.ts`
- Modify: `apps/api/src/data-source.ts`

- [ ] **Step 1: Create the entity**

Create `apps/api/src/auth/entities/email-verification-token.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('email_verification_tokens')
export class EmailVerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 2: Create the migration**

Create `apps/api/src/migrations/1779680000000-email-verification-tokens.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `email_verification_tokens`. Same shape as `password_reset_tokens`
 * — single-use, hashed, 24h TTL (set by service, not the DB). Soft-gate
 * launch policy: rows are issued on register and on /auth/resend-verification
 * but verification is NOT required for core flows. See ROADMAP.
 */
export class EmailVerificationTokens1779680000000 implements MigrationInterface {
  name = 'EmailVerificationTokens1779680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verification_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_verification_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_verification_tokens_user_id"
        ON "email_verification_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_verification_tokens_token_hash"
        ON "email_verification_tokens" ("token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_verification_tokens_token_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_verification_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_verification_tokens"`);
  }
}
```

- [ ] **Step 3: Register entity in data-source**

In `apps/api/src/data-source.ts`, add the import and entry next to `PasswordResetToken`:

```ts
import { EmailVerificationToken } from './auth/entities/email-verification-token.entity';
```

```ts
// inside entities: array
PasswordResetToken,
EmailVerificationToken,
```

- [ ] **Step 4: Build to verify types compile**

Run: `cd apps/api && npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/entities/email-verification-token.entity.ts apps/api/src/migrations/1779680000000-email-verification-tokens.ts apps/api/src/data-source.ts
git commit -m "feat(db): add email_verification_tokens table"
```

---

### Task 8: EmailVerificationService

**Files:**
- Create: `apps/api/src/auth/email-verification.service.ts`
- Test: `apps/api/src/auth/email-verification.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/auth/email-verification.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import type { User } from '../users/entities/user.entity';

const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'aram@example.com',
    firstName: 'Aram',
    lastName: 'X',
    roles: ['user'],
    language: 'ru',
    isVerified: false,
    isActive: true,
    phone: null,
    avatarUrl: null,
    googleId: null,
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

interface Mocks {
  users: { findById: ReturnType<typeof vi.fn>; findByEmail: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  mail: { send: ReturnType<typeof vi.fn> };
  repo: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  config: { get: ReturnType<typeof vi.fn> };
}

async function build(): Promise<{ service: EmailVerificationService; mocks: Mocks }> {
  const mocks: Mocks = {
    users: { findById: vi.fn(), findByEmail: vi.fn(), update: vi.fn() },
    mail: { send: vi.fn().mockResolvedValue(undefined) },
    repo: { create: vi.fn((x) => x), save: vi.fn(), findOne: vi.fn(), update: vi.fn() },
    config: { get: vi.fn((k: string) => (k === 'NEXT_PUBLIC_SITE_URL' ? 'https://gsm.example' : undefined)) },
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EmailVerificationService,
      { provide: getRepositoryToken(EmailVerificationToken), useValue: mocks.repo },
      { provide: UsersService, useValue: mocks.users },
      { provide: MailService, useValue: mocks.mail },
      { provide: ConfigService, useValue: mocks.config },
    ],
  }).compile();
  return { service: module.get(EmailVerificationService), mocks };
}

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let mocks: Mocks;
  beforeEach(async () => {
    ({ service, mocks } = await build());
  });

  it('sendVerification: saves hash and emails plaintext', async () => {
    await service.sendVerification(mockUser());
    expect(mocks.repo.save).toHaveBeenCalled();
    expect(mocks.mail.send).toHaveBeenCalled();
    const sent = mocks.mail.send.mock.calls[0][0];
    expect(sent.html).toMatch(/https:\/\/gsm\.example\/auth\/verify-email\?token=[a-f0-9]{64}/);
  });

  it('sendVerification: no-op if user is already verified', async () => {
    await service.sendVerification(mockUser({ isVerified: true }));
    expect(mocks.repo.save).not.toHaveBeenCalled();
    expect(mocks.mail.send).not.toHaveBeenCalled();
  });

  it('verifyToken: marks user verified and token used', async () => {
    const raw = 'a'.repeat(64);
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    mocks.repo.findOne.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    await service.verifyToken(raw);
    expect(mocks.users.update).toHaveBeenCalledWith('user-1', { isVerified: true });
    expect(mocks.repo.update).toHaveBeenCalledWith(
      { id: 'tok-1' },
      expect.objectContaining({ usedAt: expect.any(Date) }),
    );
  });

  it('verifyToken: rejects bad / expired token', async () => {
    mocks.repo.findOne.mockResolvedValue(null);
    await expect(service.verifyToken('z'.repeat(64))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resendVerification: sends a fresh email when user exists and not yet verified', async () => {
    mocks.users.findByEmail.mockResolvedValue(mockUser());
    await service.resendVerification('aram@example.com');
    expect(mocks.mail.send).toHaveBeenCalled();
  });

  it('resendVerification: silently returns when user does not exist or is already verified', async () => {
    mocks.users.findByEmail.mockResolvedValueOnce(null);
    await service.resendVerification('nobody@example.com');
    mocks.users.findByEmail.mockResolvedValueOnce(mockUser({ isVerified: true }));
    await service.resendVerification('aram@example.com');
    expect(mocks.mail.send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `cd apps/api && npx vitest run src/auth/email-verification.service.spec.ts`
Expected: FAIL (no module).

- [ ] **Step 3: Implement the service**

Create `apps/api/src/auth/email-verification.service.ts`:

```ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { renderVerificationEmail, type SupportedLocale } from '../mail/templates';
import type { User } from '../users/entities/user.entity';

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 24;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly tokens: Repository<EmailVerificationToken>,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Send a fresh verification email for `user`. No-op if already verified. */
  async sendVerification(user: User): Promise<void> {
    if (user.isVerified) return;

    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60_000);

    await this.tokens.save(
      this.tokens.create({ userId: user.id, tokenHash, expiresAt, usedAt: null }),
    );

    const siteUrl = this.config.get<string>('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000';
    const verifyUrl = `${siteUrl}/auth/verify-email?token=${rawToken}`;
    const locale = (user.language as SupportedLocale) ?? 'hy';
    const { subject, html } = renderVerificationEmail({
      locale,
      verifyUrl,
      firstName: user.firstName,
    });
    await this.mail.send({ to: user.email, subject, html });
    this.logger.log(`Verification email sent to ${user.email}`);
  }

  /** Resend for a user identified by email. Silent on unknown / already-verified. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.isVerified) return;
    await this.sendVerification(user);
  }

  /** Consume a token. Sets `isVerified=true` on the user. */
  async verifyToken(rawToken: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(rawToken)) {
      throw new BadRequestException('Invalid verification token');
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const row = await this.tokens.findOne({
      where: { tokenHash, usedAt: null as unknown as Date },
    });
    if (!row || row.usedAt !== null || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.users.update(row.userId, { isVerified: true });
    await this.tokens.update({ id: row.id }, { usedAt: new Date() });
    this.logger.log(`Email verified for userId=${row.userId}`);
  }
}
```

- [ ] **Step 4: Verify tests pass**

Run: `cd apps/api && npx vitest run src/auth/email-verification.service.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/email-verification.service.ts apps/api/src/auth/email-verification.service.spec.ts
git commit -m "feat(auth): email verification service with 24h tokens"
```

---

### Task 9: Wire verification into register + add endpoints

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/dto/resend-verification.dto.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Update the AuthService register-flow test**

In `apps/api/src/auth/auth.service.spec.ts`, locate the `buildService` helper (it currently mocks `UsersService`, `JwtService`, `ConfigService`). Extend it to also inject `EmailVerificationService` and `MailService` as no-op mocks. Add to the `UsersMock` interface a `create` field returning the new user (it's already there) and ensure the `buildService` providers list adds:

```ts
{ provide: EmailVerificationService, useValue: { sendVerification: vi.fn().mockResolvedValue(undefined) } },
```

Then add a new test:

```ts
describe('AuthService.register email verification', () => {
  it('sends a verification email after successful registration', async () => {
    const { service, users } = await buildService();
    const verify = vi.fn().mockResolvedValue(undefined);
    // Override the EmailVerificationService mock for this test:
    (service as any).emailVerification = { sendVerification: verify };

    users.findByEmail.mockResolvedValue(null);
    // The user the repo returns IS the user passed to sendVerification — so
    // align the create mock to the same email used in the assertion below.
    users.create.mockResolvedValue(mockUser({ id: 'new-user', email: 'newuser@example.com', isVerified: false }));

    await service.register({
      email: 'newuser@example.com',
      password: 'SecurePass123',
      firstName: 'Aram',
      lastName: 'Sargsyan',
    } as any);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0][0].email).toBe('newuser@example.com');
  });
});
```

Add the import at the top of the file:

```ts
import { EmailVerificationService } from './email-verification.service';
```

- [ ] **Step 2: Verify the test fails**

Run: `cd apps/api && npx vitest run src/auth/auth.service.spec.ts`
Expected: FAIL (AuthService does not yet send verification).

- [ ] **Step 3: Inject EmailVerificationService into AuthService**

In `apps/api/src/auth/auth.service.ts`, update the constructor and `register`:

```ts
import { EmailVerificationService } from './email-verification.service';
```

```ts
constructor(
  private readonly usersService: UsersService,
  private readonly jwtService: JwtService,
  private readonly configService: ConfigService,
  private readonly emailVerification: EmailVerificationService,
) {}
```

At the end of `register` (after `this.logger.log(...)` and before the `return`), add:

```ts
// Fire-and-forget verification email. Failures are already swallowed
// inside MailService — the user's registration must not fail because
// an email provider is slow or unreachable.
this.emailVerification.sendVerification(user).catch((err) => {
  this.logger.warn(
    `sendVerification on register failed: ${err instanceof Error ? err.message : String(err)}`,
  );
});
```

- [ ] **Step 4: Create the resend-verification DTO**

Create `apps/api/src/auth/dto/resend-verification.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}
```

- [ ] **Step 5: Add the verify-email + resend endpoints to AuthController**

In `apps/api/src/auth/auth.controller.ts`:

1. Add imports:

```ts
import { Query } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service';
import { ResendVerificationDto } from './dto/resend-verification.dto';
```

2. Add to constructor:

```ts
constructor(
  private readonly authService: AuthService,
  private readonly configService: ConfigService,
  private readonly oauthState: OAuthStateService,
  private readonly passwordReset: PasswordResetService,
  private readonly emailVerification: EmailVerificationService,
) {}
```

3. Add endpoints (group with the other password-related ones, above the Google divider):

```ts
  @Public()
  @Get('verify-email')
  async verifyEmailGet(@Query('token') token: string) {
    await this.emailVerification.verifyToken(token);
    return { message: 'Email verified' };
  }

  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Public()
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.emailVerification.resendVerification(dto.email);
    return { message: 'If that email exists and is unverified, a new link has been sent.' };
  }
```

- [ ] **Step 6: Wire the service in AuthModule**

In `apps/api/src/auth/auth.module.ts`:

```ts
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { EmailVerificationService } from './email-verification.service';
```

Update the `imports` array (replace the previous `TypeOrmModule.forFeature([PasswordResetToken])` line):

```ts
TypeOrmModule.forFeature([PasswordResetToken, EmailVerificationToken]),
```

Add `EmailVerificationService` to the `providers` array.

**Note on existing controller tests:** The AuthController constructor now takes 5 dependencies (was 4 before Task 6, now 5 after this task). Any `Test.createTestingModule({ controllers: [AuthController], providers: [...] })` block in `auth.controller.spec.ts` must list mocks for `PasswordResetService` *and* `EmailVerificationService` in its `providers` array, or Nest will throw "Nest can't resolve dependencies of AuthController" at module-compile time. Search the file for `controllers: [AuthController]` and patch every occurrence.

- [ ] **Step 7: Verify all auth tests pass**

Run: `cd apps/api && npx vitest run src/auth/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/auth/
git commit -m "feat(auth): hook email verification into register and expose endpoints"
```

---

## Workstream D — Frontend pages

### Task 10: Web forgot-password page

**Files:**
- Create: `apps/web/src/app/auth/forgot-password/page.tsx`
- Create: `apps/web/src/app/auth/forgot-password/page.spec.tsx`
- Modify: `apps/web/src/messages/ru.json`
- Modify: `apps/web/src/messages/en.json`
- Modify: `apps/web/src/messages/hy.json`

- [ ] **Step 1: Add i18n keys**

In each of `apps/web/src/messages/{ru,en,hy}.json`, append inside the `"auth": { ... }` object (before the closing brace of that section):

`ru.json`:
```json
    "forgot_link": "Забыли пароль?",
    "forgot_title": "Сброс пароля",
    "forgot_subtitle": "Введите email — отправим ссылку для сброса",
    "forgot_submit": "Отправить ссылку",
    "forgot_submitting": "Отправляем…",
    "forgot_sent_title": "Письмо отправлено",
    "forgot_sent_body": "Если такой email зарегистрирован — ссылка для сброса уже в почтовом ящике. Проверьте папку «Спам».",
    "reset_title": "Новый пароль",
    "reset_subtitle": "Задайте новый пароль для аккаунта",
    "reset_password": "Новый пароль",
    "reset_password_confirm": "Повторите пароль",
    "reset_submit": "Сохранить пароль",
    "reset_submitting": "Сохраняем…",
    "reset_success": "Пароль обновлён. Войдите с новым паролем.",
    "reset_invalid_token": "Ссылка недействительна или устарела. Запросите сброс ещё раз.",
    "verify_title": "Подтверждение email",
    "verify_pending": "Проверяем…",
    "verify_ok": "Email подтверждён. Спасибо!",
    "verify_failed": "Ссылка недействительна или устарела. Запросите письмо ещё раз.",
    "verify_banner_text": "Подтвердите email, чтобы получать уведомления.",
    "verify_banner_resend": "Отправить письмо ещё раз",
    "verify_banner_sent": "Письмо отправлено"
```

`en.json`:
```json
    "forgot_link": "Forgot password?",
    "forgot_title": "Reset password",
    "forgot_subtitle": "Enter your email — we'll send a reset link",
    "forgot_submit": "Send link",
    "forgot_submitting": "Sending…",
    "forgot_sent_title": "Email sent",
    "forgot_sent_body": "If that email is registered, a reset link is on the way. Check your spam folder if you don't see it.",
    "reset_title": "New password",
    "reset_subtitle": "Set a new password for your account",
    "reset_password": "New password",
    "reset_password_confirm": "Confirm password",
    "reset_submit": "Save password",
    "reset_submitting": "Saving…",
    "reset_success": "Password updated. Please sign in with your new password.",
    "reset_invalid_token": "This link is invalid or expired. Please request a new reset.",
    "verify_title": "Email verification",
    "verify_pending": "Verifying…",
    "verify_ok": "Email verified. Thanks!",
    "verify_failed": "This link is invalid or expired. Please request a new verification email.",
    "verify_banner_text": "Verify your email to receive notifications.",
    "verify_banner_resend": "Resend email",
    "verify_banner_sent": "Email sent"
```

`hy.json`:
```json
    "forgot_link": "Մոռացե՞լ եք գաղտնաբառը։",
    "forgot_title": "Գաղտնաբառի վերականգնում",
    "forgot_subtitle": "Մուտքագրեք էլ. փոստը՝ վերականգնման հղում ուղարկելու համար",
    "forgot_submit": "Ուղարկել հղումը",
    "forgot_submitting": "Ուղարկում ենք…",
    "forgot_sent_title": "Նամակն ուղարկված է",
    "forgot_sent_body": "Եթե այդ էլ. փոստը գրանցված է, վերականգնման հղումը արդեն ճանապարհին է։ Ստուգեք նաև «Spam» թղթապանակը։",
    "reset_title": "Նոր գաղտնաբառ",
    "reset_subtitle": "Սահմանեք նոր գաղտնաբառ ձեր հաշվի համար",
    "reset_password": "Նոր գաղտնաբառ",
    "reset_password_confirm": "Կրկնեք գաղտնաբառը",
    "reset_submit": "Պահպանել",
    "reset_submitting": "Պահպանվում է…",
    "reset_success": "Գաղտնաբառը թարմացվել է։ Մուտք գործեք նոր գաղտնաբառով։",
    "reset_invalid_token": "Հղումն անվավեր է կամ ժամկետանց։ Կրկին պահանջեք վերականգնում։",
    "verify_title": "Էլ. փոստի հաստատում",
    "verify_pending": "Ստուգում ենք…",
    "verify_ok": "Էլ. փոստը հաստատված է։ Շնորհակալություն։",
    "verify_failed": "Հղումն անվավեր է կամ ժամկետանց։ Կրկին պահանջեք հաստատման նամակ։",
    "verify_banner_text": "Հաստատեք էլ. փոստը՝ ծանուցումներ ստանալու համար։",
    "verify_banner_resend": "Կրկին ուղարկել",
    "verify_banner_sent": "Նամակն ուղարկված է"
```

- [ ] **Step 2: Write the page test**

Create `apps/web/src/app/auth/forgot-password/page.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import ForgotPasswordPage from './page';
import { api } from '@/lib/api';
import messages from '@/messages/en.json';

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn() },
}));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    (api.post as any).mockReset();
  });

  it('submits the email and shows success state', async () => {
    (api.post as any).mockResolvedValue({ data: { message: 'ok' } });
    render(wrap(<ForgotPasswordPage />));

    fireEvent.change(screen.getByPlaceholderText(/example/i), {
      target: { value: 'aram@example.com' },
    });
    fireEvent.click(screen.getByText(/send link/i));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'aram@example.com',
      });
    });
    expect(await screen.findByText(/email sent/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `cd apps/web && npx vitest run src/app/auth/forgot-password/page.spec.tsx`
Expected: FAIL (cannot find `./page`).

- [ ] **Step 4: Write the page**

Create `apps/web/src/app/auth/forgot-password/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';

type FormData = { email: string };

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [sent, setSent] = useState(false);

  const schema = z.object({
    email: z.string().email(t('error_invalid_email')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/auth/forgot-password', data).then((r: any) => r.data),
    onSuccess: () => setSent(true),
  });

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <h1 className="text-2xl font-black text-white mb-2">{t('forgot_title')}</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          {t('forgot_subtitle')}
        </p>

        {sent ? (
          <div>
            <h2 className="text-xl font-bold text-white mb-2">{t('forgot_sent_title')}</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {t('forgot_sent_body')}
            </p>
            <Link
              href="/auth/login"
              className="block mt-6 text-center text-white underline hover:no-underline"
            >
              {t('go_login')}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit((d) => mutation.mutate(d))}
            noValidate
            className="space-y-4"
          >
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('email')}
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="user@example.com"
                className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              {errors.email && (
                <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50 mt-2"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {mutation.isPending ? t('forgot_submitting') : t('forgot_submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify the test passes**

Run: `cd apps/web && npx vitest run src/app/auth/forgot-password/page.spec.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/auth/forgot-password/ apps/web/src/messages/
git commit -m "feat(web): /auth/forgot-password page + reset/verify i18n strings"
```

---

### Task 11: Web reset-password page

**Files:**
- Create: `apps/web/src/app/auth/reset-password/page.tsx`
- Create: `apps/web/src/app/auth/reset-password/page.spec.tsx`

- [ ] **Step 1: Write the page test**

Create `apps/web/src/app/auth/reset-password/page.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import ResetPasswordPage from './page';
import { api } from '@/lib/api';
import messages from '@/messages/en.json';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('token=' + 'a'.repeat(64)),
}));

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    (api.post as any).mockReset();
  });

  it('submits the token + password and shows success', async () => {
    (api.post as any).mockResolvedValue({ data: { message: 'ok' } });
    render(wrap(<ResetPasswordPage />));

    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], {
      target: { value: 'newPassword12' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[1], {
      target: { value: 'newPassword12' },
    });
    fireEvent.click(screen.getByText(/save password/i));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'a'.repeat(64),
        password: 'newPassword12',
      });
    });
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `cd apps/web && npx vitest run src/app/auth/reset-password/page.spec.tsx`
Expected: FAIL (no module).

- [ ] **Step 3: Write the page**

Create `apps/web/src/app/auth/reset-password/page.tsx`:

```tsx
'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

type FormData = { password: string; passwordConfirm: string };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [done, setDone] = useState(false);

  const schema = z
    .object({
      password: z.string().min(8, t('error_password_min')),
      passwordConfirm: z.string().min(8, t('error_password_min')),
    })
    .refine((d) => d.password === d.passwordConfirm, {
      path: ['passwordConfirm'],
      message: t('error_passwords_mismatch'),
    });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/auth/reset-password', { token, password: data.password }).then((r: any) => r.data),
    onSuccess: () => setDone(true),
  });

  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <p className="text-red-400">{t('reset_invalid_token')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <h1 className="text-2xl font-black text-white mb-2">{t('reset_title')}</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          {t('reset_subtitle')}
        </p>

        {done ? (
          <div>
            <p className="text-white mb-6">{t('reset_success')}</p>
            <Link
              href="/auth/login"
              className="block text-center text-white underline hover:no-underline"
            >
              {t('go_login')}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit((d) => mutation.mutate(d))}
            noValidate
            className="space-y-4"
          >
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('reset_password')}
              </label>
              <input
                {...register('password')}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              {errors.password && (
                <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
              )}
            </div>
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('reset_password_confirm')}
              </label>
              <input
                {...register('passwordConfirm')}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              {errors.passwordConfirm && (
                <p className="text-xs text-red-400 mt-1">{errors.passwordConfirm.message}</p>
              )}
            </div>
            {mutation.isError && (
              <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
                {(mutation.error as any)?.response?.data?.message ?? t('reset_invalid_token')}
              </p>
            )}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50 mt-2"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {mutation.isPending ? t('reset_submitting') : t('reset_submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify test passes**

Run: `cd apps/web && npx vitest run src/app/auth/reset-password/page.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/auth/reset-password/
git commit -m "feat(web): /auth/reset-password page"
```

---

### Task 12: Web verify-email page

**Files:**
- Create: `apps/web/src/app/auth/verify-email/page.tsx`
- Create: `apps/web/src/app/auth/verify-email/page.spec.tsx`

- [ ] **Step 1: Write the page test**

Create `apps/web/src/app/auth/verify-email/page.spec.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import VerifyEmailPage from './page';
import { api } from '@/lib/api';
import messages from '@/messages/en.json';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=' + 'a'.repeat(64)),
}));

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('VerifyEmailPage', () => {
  it('shows success on 200', async () => {
    (api.get as any).mockResolvedValue({ data: { message: 'ok' } });
    render(wrap(<VerifyEmailPage />));
    expect(await screen.findByText(/email verified/i)).toBeInTheDocument();
  });

  it('shows error on 400', async () => {
    (api.get as any).mockRejectedValue({ response: { status: 400 } });
    render(wrap(<VerifyEmailPage />));
    await waitFor(() => expect(screen.getByText(/invalid or expired/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `cd apps/web && npx vitest run src/app/auth/verify-email/page.spec.tsx`
Expected: FAIL (no module).

- [ ] **Step 3: Write the page**

Create `apps/web/src/app/auth/verify-email/page.tsx`:

```tsx
'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const mutation = useMutation({
    mutationFn: (tok: string) =>
      api.get(`/auth/verify-email?token=${encodeURIComponent(tok)}`).then((r: any) => r.data),
  });

  // Trigger once on mount with the token from the URL.
  useEffect(() => {
    if (token) mutation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8 text-center"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <h1 className="text-2xl font-black text-white mb-6">{t('verify_title')}</h1>
        {mutation.isPending && <p className="text-white">{t('verify_pending')}</p>}
        {mutation.isSuccess && <p className="text-green-400">{t('verify_ok')}</p>}
        {mutation.isError && <p className="text-red-400">{t('verify_failed')}</p>}
        {(mutation.isSuccess || mutation.isError) && (
          <Link
            href="/auth/login"
            className="block mt-6 text-white underline hover:no-underline"
          >
            {t('go_login')}
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify test passes**

Run: `cd apps/web && npx vitest run src/app/auth/verify-email/page.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/auth/verify-email/
git commit -m "feat(web): /auth/verify-email page"
```

---

### Task 13: Email-verification banner + login forgot link

**Files:**
- Create: `apps/web/src/components/auth/EmailVerificationBanner.tsx`
- Modify: `apps/web/src/app/auth/login/page.tsx`

- [ ] **Step 1: Create the banner component**

Create `apps/web/src/components/auth/EmailVerificationBanner.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

/**
 * Shown on any authenticated page when the current user has not verified
 * their email. Soft gate — does NOT block access. Calls
 * /auth/resend-verification to fire a fresh email.
 *
 * Consumer is responsible for deciding when to render this (read the
 * currentUser query and only mount if `isVerified === false`).
 */
export function EmailVerificationBanner({ email }: { email: string }) {
  const t = useTranslations('auth');
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/resend-verification', { email }).then((r: any) => r.data),
    onSuccess: () => setSent(true),
  });

  return (
    <div
      role="status"
      className="w-full px-4 py-3 flex items-center justify-between gap-4 text-sm border-b border-amber-400/30"
      style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: 'var(--color-text-primary)' }}
    >
      <span>{t('verify_banner_text')}</span>
      {sent ? (
        <span className="text-amber-300">{t('verify_banner_sent')}</span>
      ) : (
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="underline hover:no-underline disabled:opacity-50"
        >
          {t('verify_banner_resend')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the "Forgot password?" link to login page**

In `apps/web/src/app/auth/login/page.tsx`, locate the password field block (the `<div>` containing `register('password')`). Immediately after the closing `</div>` of that block and before the error display, insert:

```tsx
<div className="text-right">
  <Link
    href="/auth/forgot-password"
    className="text-xs underline"
    style={{ color: 'var(--color-text-secondary)' }}
  >
    {t('forgot_link')}
  </Link>
</div>
```

`Link` is already imported in that file.

- [ ] **Step 3: Build the web app to ensure no type errors**

Run: `cd apps/web && npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Run the existing login page test to confirm no regression**

Run: `cd apps/web && npx vitest run src/app/auth/login/page.spec.tsx`
Expected: PASS (the link is a non-breaking addition).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/auth/EmailVerificationBanner.tsx apps/web/src/app/auth/login/page.tsx
git commit -m "feat(web): email verification banner + forgot-password link on login"
```

---

## Workstream E — Migration-on-deploy + npm scripts

### Task 14: Add `migration:show` and `start:prod:migrate` scripts

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Open `apps/api/package.json` and find the `"scripts"` block**

Inside `"scripts": { ... }`, add two new entries after `"migration:revert"`:

```json
"migration:show": "typeorm migration:show -d src/data-source.ts",
"start:prod:migrate": "npm run migration:run && node dist/main"
```

The block should end up looking like:

```json
"scripts": {
  "dev": "nest start --watch",
  "build": "nest build",
  "start": "node dist/main",
  "start:prod": "node dist/main",
  "start:prod:migrate": "npm run migration:run && node dist/main",
  "lint": "eslint \"src/**/*.ts\"",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "vitest run --config vitest.e2e.config.ts",
  "typecheck": "tsc --noEmit",
  "migration:generate": "typeorm migration:generate -d src/data-source.ts",
  "migration:run": "typeorm migration:run -d src/data-source.ts",
  "migration:revert": "typeorm migration:revert -d src/data-source.ts",
  "migration:show": "typeorm migration:show -d src/data-source.ts"
}
```

- [ ] **Step 2: Smoke the new script locally**

Run: `cd apps/api && npm run migration:show`
Expected: lists migrations (with `[X]` for applied and `[ ]` for pending) against the dev DB. If the dev DB is not running, the command may fail with a connection error — that's still proof the script is wired correctly.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json
git commit -m "chore(api): add migration:show and start:prod:migrate scripts"
```

---

## Workstream F — Database backups (GHA + R2)

### Task 15: Backup script

**Files:**
- Create: `scripts/backup-db.sh`

- [ ] **Step 1: Create the script**

Create `scripts/backup-db.sh`:

```bash
#!/usr/bin/env bash
#
# Daily Postgres → Cloudflare R2 backup.
#
# Run from the GitHub Actions backup workflow OR ad-hoc from any
# environment that has these env vars set:
#
#   DATABASE_URL          Production Postgres URL (postgresql://...)
#   R2_ENDPOINT           e.g. https://<account>.r2.cloudflarestorage.com
#   R2_BUCKET             Bucket name, e.g. gsm-sports-backups
#   R2_ACCESS_KEY_ID      R2 access key (created in Cloudflare dashboard)
#   R2_SECRET_ACCESS_KEY  R2 secret
#
# Produces an object named YYYY/MM/DD/gsm-<ISO>.sql.gz in R2.
# Exits non-zero on dump or upload failure — failure must propagate so
# the GHA job goes red and the alert fires.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${R2_ENDPOINT:?R2_ENDPOINT is required}"
: "${R2_BUCKET:?R2_BUCKET is required}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"

TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
DATE_PATH="$(date -u +%Y/%m/%d)"
KEY="${DATE_PATH}/gsm-${TS}.sql.gz"

echo "[backup] dumping to ${KEY}"

# pg_dump -Fc would be smaller, but plain SQL is restorable with psql alone
# (no pg_restore needed), which keeps the restore runbook simple.
pg_dump --no-owner --no-privileges "${DATABASE_URL}" | gzip -9 > "/tmp/backup.sql.gz"

# Upload via aws CLI (R2 is S3-compatible). The CLI must already be
# installed (the GHA runner image ships with it).
AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
aws s3 cp /tmp/backup.sql.gz "s3://${R2_BUCKET}/${KEY}" \
  --endpoint-url "${R2_ENDPOINT}" \
  --no-progress

SIZE="$(stat -c%s /tmp/backup.sql.gz 2>/dev/null || stat -f%z /tmp/backup.sql.gz)"
echo "[backup] uploaded ${SIZE} bytes to s3://${R2_BUCKET}/${KEY}"
rm -f /tmp/backup.sql.gz
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/backup-db.sh
```

- [ ] **Step 3: Dry-syntax check**

```bash
bash -n scripts/backup-db.sh
```

Expected: no output (syntactically valid).

- [ ] **Step 4: Commit**

```bash
git add scripts/backup-db.sh
git commit -m "feat(ops): daily Postgres backup script to Cloudflare R2"
```

---

### Task 16: GitHub Actions backup workflow

**Files:**
- Create: `.github/workflows/backup.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/backup.yml`:

```yaml
name: Database Backup

on:
  schedule:
    # Daily at 03:00 UTC. Cron uses the default branch only — make sure
    # `main` has this file before relying on the schedule.
    - cron: '0 3 * * *'
  workflow_dispatch: # allow manual trigger from the Actions tab

permissions:
  contents: read

jobs:
  backup:
    name: pg_dump → R2
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - name: Install postgres client
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y --no-install-recommends postgresql-client

      - name: Run backup script
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
          R2_ENDPOINT: ${{ secrets.R2_ENDPOINT }}
          R2_BUCKET: ${{ secrets.R2_BUCKET }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
        run: ./scripts/backup-db.sh
```

- [ ] **Step 2: Sanity-check workflow YAML**

If you have the GitHub CLI: `gh workflow view backup.yml` (after pushing). Otherwise just confirm in your editor that it parses (a YAML syntax extension will flag issues).

- [ ] **Step 3: Note required secrets in the deploy runbook**

This is done in the runbook task (Task 17). For now, just commit the workflow.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/backup.yml
git commit -m "ci: scheduled daily database backup to R2"
```

---

### Task 17: Restore-from-backup runbook

**Files:**
- Create: `docs/runbooks/restore-from-backup.md`

- [ ] **Step 1: Create the runbook**

Create `docs/runbooks/restore-from-backup.md`:

````markdown
# Restore database from backup

**Trigger:** Production data loss or corruption — needs a point-in-time restore from a `pg_dump` snapshot stored in Cloudflare R2.
**Last tested:** _Pending — first restore drill is part of the launch-week go-live gate._
**Estimated time:** 15–30 minutes for a database under ~1 GB.
**Risk level:** High — restores overwrite live data. Always restore to a fresh database first when possible.

## Prerequisites

- Access to the R2 bucket (`R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` in your local env, or via Cloudflare dashboard).
- `aws` CLI installed locally (R2 is S3-compatible).
- `psql` and `gunzip` available locally.
- A target Postgres URL — **prefer a fresh DB**, not the live one, for verification.

## Steps

### 1. List recent backups

```sh
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws s3 ls s3://gsm-sports-backups/ --recursive \
  --endpoint-url "$R2_ENDPOINT" \
  | sort | tail -10
```

You'll see keys like `2026/05/19/gsm-2026-05-19T03-00-00Z.sql.gz`.

### 2. Download the target backup

```sh
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws s3 cp s3://gsm-sports-backups/2026/05/19/gsm-2026-05-19T03-00-00Z.sql.gz /tmp/restore.sql.gz \
  --endpoint-url "$R2_ENDPOINT"
```

### 3. Restore to a **fresh** database first

Create or pick an empty database. Never restore over the live DB until verified.

```sh
# Example: a Railway preview branch or a local docker compose Postgres.
RESTORE_URL="postgresql://user:pass@host:5432/gsm_restore"

gunzip -c /tmp/restore.sql.gz | psql "$RESTORE_URL"
```

### 4. Verify

Connect with `psql "$RESTORE_URL"` and spot-check:

```sql
SELECT count(*) FROM users;
SELECT count(*) FROM tournaments;
SELECT max(created_at) FROM users; -- should be near the backup timestamp
```

### 5. Promote (only if step 4 looks correct)

If the restore database itself is the new prod (e.g., a Railway "swap" path), update the production `DATABASE_URL` and restart the api.

If you're restoring INTO the existing prod database (more invasive):

```sh
# Take an emergency snapshot of the current corrupt state first.
pg_dump "$PROD_DATABASE_URL" | gzip > "/tmp/emergency-pre-restore-$(date -u +%FT%TZ).sql.gz"

# Drop and recreate schema, then load.
psql "$PROD_DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c /tmp/restore.sql.gz | psql "$PROD_DATABASE_URL"
```

### 6. Run any pending migrations

If the restored snapshot is older than the deployed code:

```sh
DATABASE_URL="$PROD_DATABASE_URL" npm run migration:run --workspace=@gsm/api
```

### 7. Smoke test the live site

- `curl https://api.<your-domain>/ready` → 200.
- Sign in as admin, open the admin tournaments list, open one tournament page.

## Verification (drill — to be run as part of go-live)

- [ ] A backup uploaded in the last 24 hours is listed in R2.
- [ ] Download succeeds.
- [ ] Restore to a throwaway DB succeeds without errors.
- [ ] `users` and `tournaments` row counts roughly match production.
- [ ] No orphan-foreign-key warnings in the psql output.

## Notes

- **Retention is manual for now.** R2 keeps everything; cull older than 30 days with a one-shot `aws s3 rm --recursive` if storage grows.
- **The `pg_dump` is logical (plain SQL).** It does NOT preserve sequence IDs across schema-only upgrades — always run migrations after restore if the schema has moved forward.
- **Don't restore over the live DB during an outage without first taking the emergency snapshot.** Without it you can't tell whether a restore made things worse.
````

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/restore-from-backup.md
git commit -m "docs(runbooks): add restore-from-backup procedure"
```

---

## Workstream G — Deploy + observability docs

### Task 18: Refresh deploy-production runbook

**Files:**
- Modify: `docs/runbooks/deploy-production.md`

- [ ] **Step 1: Update the runbook**

Open `docs/runbooks/deploy-production.md`. Apply these changes:

1. **Change the "Last tested" line** to mark the first deploy date once it's done. For now, leave a placeholder you'll update at go-live, but add a row about Railway+Vercel native deploy:

   At the top of the file, after "Last tested:", append a new line:

   ```markdown
   **Deploy model:** Native Railway + Vercel auto-deploy off `main`. No custom GitHub Actions deploy job — `main` is already gated by the `ci-success` aggregate check via branch protection.
   ```

2. **Add a "Railway-specific notes" block** after the "Required env vars" section:

   ```markdown
   ## Railway-specific configuration

   In the Railway dashboard for the api service:

   - **Source**: this repo, branch `main`. Auto-deploy enabled.
   - **Dockerfile path**: `apps/api/Dockerfile` (Railway detects it; double-check).
   - **Pre-deploy command** (Railway calls this once per release before swapping traffic):

     ```
     npm run migration:run --workspace=@gsm/api
     ```

   - **Start command**: leave empty (the Dockerfile `CMD` `node dist/main` is correct).
   - **Postgres + Redis**: add as Railway services; copy their connection URLs into the api service's env (`DATABASE_URL`, `REDIS_URL`).
   - **Health check path**: `/health` (Railway uses this to gate traffic to a new revision).

   ## Vercel-specific configuration

   In the Vercel dashboard for the web project:

   - **Root directory**: `apps/web`.
   - **Framework preset**: Next.js (auto-detected).
   - **Production branch**: `main`. Auto-deploy enabled.
   - **Env vars**: per the "Web (@gsm/web)" list above.
   - **Skip the standalone Dockerfile** — Vercel builds with its own pipeline. `apps/web/Dockerfile` is only used by Coolify/self-hosted paths.
   ```

3. **Add new env vars** in the API env-vars block:

   ```
   # Email — Resend (sender requires verified domain)
   RESEND_API_KEY=re_...
   MAIL_FROM=GSM Sports <no-reply@your-domain>

   # Used in reset / verification email link URLs (must match the public web URL)
   NEXT_PUBLIC_SITE_URL=https://your-domain
   ```

4. **Update Step 2 (migrations)** — replace the prose with the cleaner Railway-native path:

   ```markdown
   2. **Database migrations.**

      Migrations run automatically via Railway's pre-deploy command (`npm run migration:run --workspace=@gsm/api`). To see status manually:

      ```sh
      cd apps/api && npm run migration:show
      ```

      To run a one-off from local against prod (rarely needed):

      ```sh
      DATABASE_URL="$PROD_DATABASE_URL" npm run migration:run --workspace=@gsm/api
      ```
   ```

5. **Add a "Resend setup" subsection** before "Steps":

   ```markdown
   ## Resend (email) setup

   1. Create a Resend account (free tier covers 3 000 emails/mo).
   2. Add your sending domain (e.g. `mail.<your-domain>`). Resend will show DNS records — add the three records (SPF, DKIM, DMARC) at Cloudflare. Verification usually completes in minutes.
   3. Create an API key, paste into Railway as `RESEND_API_KEY`.
   4. Set `MAIL_FROM` to a sender on the verified domain, e.g. `GSM Sports <no-reply@mail.your-domain>`.
   5. Test deliverability: hit `/v1/auth/forgot-password` with a real address and confirm the email lands in the primary inbox (not spam) for at least Gmail, iCloud, and Yandex.
   ```

- [ ] **Step 2: Verify the file still reads coherently**

Open `docs/runbooks/deploy-production.md` and read top-to-bottom. The flow should be: prereqs → required env vars → Railway/Vercel config → Resend setup → Steps → Verification → Rollback → Notes.

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/deploy-production.md
git commit -m "docs(runbooks): Railway + Vercel native deploy, Resend setup, env vars"
```

---

### Task 19: Uptime-monitoring runbook

**Files:**
- Create: `docs/runbooks/uptime-monitoring.md`

- [ ] **Step 1: Create the runbook**

Create `docs/runbooks/uptime-monitoring.md`:

````markdown
# Uptime monitoring

**Goal:** an external service pings `/health` (api) and `/` (web) every minute and alerts on failure.

## Recommended provider: Better Stack (formerly Better Uptime)

Free tier: 10 monitors, 3-minute checks. Sufficient for launch.

Alternative: UptimeRobot — slightly less polished UI, similar free tier.

## Setup

1. Create an account at https://betterstack.com.
2. Add two **HTTP monitors**:

   | Monitor name | URL | Expected | Interval |
   |---|---|---|---|
   | GSM API health | `https://api.<your-domain>/health` | 200, JSON contains `"status":"ok"` | 1 min |
   | GSM Web | `https://<your-domain>/` | 200 | 1 min |

   Both endpoints are `@Public()` + `@SkipThrottle()` server-side (see `apps/api/src/health/health.controller.ts`), so the monitor needs no credentials.

3. Add a Telegram alert channel:
   - In Better Stack: Integrations → Telegram → follow the prompt to add the Better Stack bot to your Telegram group.
   - Route both monitors to that channel.

4. Force a test alert:
   - Pause the api monitor's target URL (temporarily stop the Railway service, or change the monitor URL to a 404 endpoint).
   - Confirm an alert lands in Telegram within ~5 minutes.
   - Restore the monitor.

## Verification

- [ ] Both monitors are in "Up" state.
- [ ] Test alert reached Telegram and recovery alert followed.
- [ ] Status page (if you enabled the public one) shows both monitors green.

## Notes

- **Don't put auth on `/health`.** The monitor is unauthenticated by design.
- **Watch `/ready`, not `/health`, only if you want the alert to fire when the DB is unreachable.** For launch we keep `/health` (process alive) as the primary signal — DB hiccups will surface in Sentry; the uptime monitor watches "is the box up."
- **First-week noise:** expect 1–2 false positives from cold deploys. After two weeks of stability you can tighten the alert threshold.
````

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/uptime-monitoring.md
git commit -m "docs(runbooks): uptime monitoring setup for Better Stack"
```

---

### Task 20: Vercel monorepo config note

**Files:**
- Create: `apps/web/vercel.json`

- [ ] **Step 1: Add minimal vercel.json**

Most config lives in the Vercel dashboard. The one thing worth pinning in version control is the install command — Turborepo monorepos need Vercel to install from repo root.

Create `apps/web/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "cd ../.. && npm install",
  "buildCommand": "cd ../.. && npx turbo run build --filter=@gsm/web",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/vercel.json
git commit -m "chore(web): vercel.json pinning turborepo install/build commands"
```

---

## Workstream H — STATUS / ROADMAP refresh

### Task 21: Refresh STATUS.md

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Update the header date**

Change the first line:

```markdown
> Last updated: 20 May 2026 · Bump this header when adding rows.
```

- [ ] **Step 2: Fix the stale OAuth row**

In the "Auth & security" table, change:

```markdown
| OAuth (Google/Facebook) | 🔴 | Entity sketched in DB schema; no implementation |
```

to:

```markdown
| OAuth (Google) | 🟢 | PR #97 + #101; set-password flow for Google-only accounts |
| OAuth (Facebook) | ⚫ | Out of scope for launch |
```

- [ ] **Step 3: Add new rows for the work this week**

In "Auth & security":

```markdown
| Password reset (email) | 🟢 | `password_reset_tokens` table, /v1/auth/forgot-password + /v1/auth/reset-password, Resend |
| Email verification flow | 🟢 (soft gate) | `email_verification_tokens` + banner; not gated on flows |
| Account recovery via Telegram | 🔴 | Deferred post-launch |
```

In "Observability & ops":

```markdown
| Sentry (api + web) | 🟢 | Activates when DSN env-var is set; verified live in launch week |
| Database backups | 🟢 | GHA daily pg_dump → R2 + Railway managed backups |
| Disaster recovery drill | 🟢 | First drill completed at go-live; runbook at docs/runbooks/restore-from-backup.md |
| Production deploy workflow | 🟢 | Railway + Vercel native auto-deploy off `main`; runbook updated |
```

In "Notifications & comms":

```markdown
| Email | 🟢 | Resend (transactional only — reset + verification) |
```

- [ ] **Step 2.5: Verify file**

Skim the whole file once. Any row that still claims 🔴 for something this plan delivers should be promoted. Any 🟡 that became 🟢 (legal text after Termly, etc.) should also be updated — though the legal-text row may stay 🟡 until the user delivers the final text; leave it 🟡 with a note "Termly text pending hand-off."

- [ ] **Step 3: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs(status): refresh for production-launch week work"
```

---

### Task 22: Refresh ROADMAP.md

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Update the header date**

```markdown
> Last updated: 20 May 2026 · Move the "Current phase" pointer when finishing a phase.
```

- [ ] **Step 2: Move completed items in Phase 1 from 🔴 to 🟢**

In the "Pending (engineering)" block, change:

```markdown
- 🔴 Forgot-password via email (provider once chosen)
- 🔴 Email verification flow
```

to:

```markdown
- 🟢 Forgot-password via email (Resend) — landed this launch week
- 🟢 Email verification flow (soft gate banner) — landed this launch week
- 🔴 Account recovery via Telegram (deferred post-launch)
```

- [ ] **Step 3: Remove the false "script template ready" claim**

Find the line about "Database backup cron (script template ready)". The template did not actually exist before this plan — `scripts/backup-db.sh` is created in Task 15. Change to:

```markdown
- 🟢 Database backup cron — daily `pg_dump → R2` via GHA workflow
```

- [ ] **Step 4: Add a note to phase-exit criteria reflecting the go-live drill**

After the existing exit criteria (which already numbers items 1, 2, 3), append item 4:

```markdown
4. (Launch-specific) Restore drill from a real backup completed and documented in `docs/runbooks/restore-from-backup.md`.
```

- [ ] **Step 5: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): mark launch-week deliverables done"
```

---

## Workstream I — Final integration check

### Task 23: End-to-end smoke (local)

**Files:** none modified — verification only.

- [ ] **Step 1: Bring up local services**

```bash
docker compose up -d postgres redis
cd apps/api && npm run migration:run
```

Expected: migrations run cleanly, including `1779580000000-password-reset-tokens` and `1779680000000-email-verification-tokens`.

- [ ] **Step 2: Start api and web in dev**

In two terminals:

```bash
cd apps/api && npm run dev
```

```bash
cd apps/web && npm run dev
```

- [ ] **Step 3: Walk the new flows**

In a browser at `http://localhost:3000`:

1. Register a new user. Note: with `RESEND_API_KEY` unset, the api logs the email content (look for `[mail disabled] would send to=...`) — copy the verification link from the log and paste into the browser. Verify it resolves to "Email verified."
2. Log out. Click "Forgot password?" on the login page. Submit your email. Check the api log for the reset link. Paste it into the browser. Set a new password. Sign in with the new password.

- [ ] **Step 4: Run the full test suite**

```bash
cd apps/api && npm run test
cd apps/web && npm run test
```

Expected: all green. If anything fails, fix and rerun before moving to Task 24.

- [ ] **Step 5: Commit (only if you had to fix anything)**

```bash
git add -p
git commit -m "fix: address smoke-test fallout from password reset / email verify wiring"
```

If no changes were needed, skip this step.

---

### Task 24: Tag and prepare go-live PR

**Files:** none modified.

- [ ] **Step 1: Ensure all CI checks pass locally first**

```bash
npx turbo run lint
npx turbo run typecheck
npx turbo run build
npx turbo run test
```

Expected: all clean.

- [ ] **Step 2: Push the branch and open PRs**

This plan produces ~22 commits. They can ship as one PR ("Production launch week") or be broken up — recommendation: one PR per workstream (A through H) for reviewability, merged in order.

- [ ] **Step 3: Run the go-live checklist from the spec**

Once Railway + Vercel + Resend + Cloudflare + Sentry + Better Stack accounts are configured per the manual tasks (M1–M9 in the spec), run through every checkbox in Section 7 of `docs/superpowers/specs/2026-05-20-production-launch-week-design.md`. Each item must be verified, not assumed.

- [ ] **Step 4: Tag the first production deploy**

```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## Notes and caveats

- **Session invalidation on password reset** is intentionally *not* implemented in this week's plan. The access-token cookie expires in 15 minutes, and the frontend does not currently use refresh tokens, so the effective session-invalidation window is 15 minutes. A `passwordChangedAt`-column-plus-JwtStrategy-DB-check is a post-launch hardening tracked under Phase 2 / Security in `docs/ROADMAP.md`.
- **The mail service swallows errors by design.** Don't change that without thinking through which callers can tolerate a 500 from a slow Resend response. Register and forgot-password both call mail in fire-and-forget mode; making mail throw would 500 those endpoints on transient mail-provider outages.
- **`docs/08-DEPLOYMENT.md`** still shows an example GHA deploy job that doesn't match the chosen "native auto-deploy" model. It's documentation that predates the spec; leaving it untouched is fine, but if you want consistency, replace its Section 4 with a pointer to `docs/runbooks/deploy-production.md`. Not a launch blocker.

---

## Coverage map (plan ↔ spec sections)

| Spec section | Plan task(s) |
|---|---|
| 4.1 Mail module | Tasks 1–2 |
| 4.2 Password reset | Tasks 3–6 |
| 4.3 Email verification | Tasks 7–9, 13 (banner) |
| 4.4 Deploy pipeline | Tasks 18, 20 |
| 4.5 Migrations on deploy | Tasks 14, 18 |
| 4.6 Backups | Tasks 15–17 |
| 4.7 Uptime monitoring | Task 19 |
| 4.8 Sentry activation | Task 18 (env vars), Task 23 (smoke) |
| 4.9 STATUS/ROADMAP refresh | Tasks 21–22 |
| Frontend web pages | Tasks 10–13 |
| Section 7 — Go-live checklist | Task 24 |
