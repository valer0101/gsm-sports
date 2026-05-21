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
