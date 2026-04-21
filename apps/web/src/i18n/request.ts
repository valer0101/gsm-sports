import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, pickLocaleFromAcceptLanguage } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  let locale = isLocale(cookieLocale) ? cookieLocale : null;

  if (!locale) {
    const headerStore = await headers();
    locale = pickLocaleFromAcceptLanguage(headerStore.get('accept-language'));
  }

  if (!locale) locale = DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
