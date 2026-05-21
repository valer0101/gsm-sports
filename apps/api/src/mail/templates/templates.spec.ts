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
