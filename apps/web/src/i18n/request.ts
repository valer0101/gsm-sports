import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('gsm_lang')?.value || 'hy';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
