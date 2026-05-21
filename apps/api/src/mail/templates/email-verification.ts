import { escapeHtml } from './escape';

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
  const safeName = escapeHtml(p.firstName);
  return {
    subject: subjects[locale],
    html: `${greetings[locale](safeName)}\n${bodies[locale](p.verifyUrl)}`,
  };
}
