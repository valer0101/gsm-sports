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
