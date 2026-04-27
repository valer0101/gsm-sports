/**
 * Country data: ISO-3166-1 alpha-2 + alpha-3 codes, localized names (en/ru/hy),
 * and freeform aliases used at registration time.
 *
 * Coverage is deliberately partial — ~75 countries chosen for sport relevance
 * (post-USSR, EU, Americas, key Asia). Unknown inputs return null from
 * `normalizeToIso2`, and the UI shows the raw text as fallback.
 *
 * Names are not exhaustive: when an Armenian name is uncertain, the field is
 * omitted and `iso2ToName` falls back to the Russian name.
 */

export interface CountryRecord {
  iso2: string;
  iso3: string;
  nameEn: string;
  nameRu: string;
  nameHy?: string;
  aliases?: string[];
}

export const COUNTRIES: ReadonlyArray<CountryRecord> = [
  // post-USSR + immediate neighbours
  { iso2: 'RU', iso3: 'RUS', nameEn: 'Russia', nameRu: 'Россия', nameHy: 'Ռուսաստան',
    aliases: ['Russian Federation', 'РФ', 'Российская Федерация'] },
  { iso2: 'UA', iso3: 'UKR', nameEn: 'Ukraine', nameRu: 'Украина', nameHy: 'Ուկրաինա' },
  { iso2: 'BY', iso3: 'BLR', nameEn: 'Belarus', nameRu: 'Беларусь', nameHy: 'Բելառուս',
    aliases: ['Белоруссия'] },
  { iso2: 'KZ', iso3: 'KAZ', nameEn: 'Kazakhstan', nameRu: 'Казахстан', nameHy: 'Ղազախստան' },
  { iso2: 'AM', iso3: 'ARM', nameEn: 'Armenia', nameRu: 'Армения', nameHy: 'Հայաստան',
    aliases: ['Republic of Armenia', 'Hayastan'] },
  { iso2: 'AZ', iso3: 'AZE', nameEn: 'Azerbaijan', nameRu: 'Азербайджан', nameHy: 'Ադրբեջան' },
  { iso2: 'GE', iso3: 'GEO', nameEn: 'Georgia', nameRu: 'Грузия', nameHy: 'Վրաստան' },
  { iso2: 'KG', iso3: 'KGZ', nameEn: 'Kyrgyzstan', nameRu: 'Киргизия', nameHy: 'Ղրղզստան',
    aliases: ['Kyrgyz Republic', 'Кыргызстан'] },
  { iso2: 'UZ', iso3: 'UZB', nameEn: 'Uzbekistan', nameRu: 'Узбекистан', nameHy: 'Ուզբեկստան' },
  { iso2: 'TJ', iso3: 'TJK', nameEn: 'Tajikistan', nameRu: 'Таджикистан', nameHy: 'Տաջիկստան' },
  { iso2: 'TM', iso3: 'TKM', nameEn: 'Turkmenistan', nameRu: 'Туркменистан', nameHy: 'Թուրքմենստան' },
  { iso2: 'MD', iso3: 'MDA', nameEn: 'Moldova', nameRu: 'Молдова', nameHy: 'Մոլդովա',
    aliases: ['Moldavia', 'Молдавия'] },
  { iso2: 'EE', iso3: 'EST', nameEn: 'Estonia', nameRu: 'Эстония', nameHy: 'Էստոնիա' },
  { iso2: 'LV', iso3: 'LVA', nameEn: 'Latvia', nameRu: 'Латвия', nameHy: 'Լատվիա' },
  { iso2: 'LT', iso3: 'LTU', nameEn: 'Lithuania', nameRu: 'Литва', nameHy: 'Լիտվա' },

  // major Europe
  { iso2: 'GB', iso3: 'GBR', nameEn: 'United Kingdom', nameRu: 'Великобритания', nameHy: 'Մեծ Բրիտանիա',
    aliases: ['UK', 'Britain', 'Great Britain', 'England', 'Англия'] },
  { iso2: 'DE', iso3: 'DEU', nameEn: 'Germany', nameRu: 'Германия', nameHy: 'Գերմանիա',
    aliases: ['Deutschland'] },
  { iso2: 'FR', iso3: 'FRA', nameEn: 'France', nameRu: 'Франция', nameHy: 'Ֆրանսիա' },
  { iso2: 'IT', iso3: 'ITA', nameEn: 'Italy', nameRu: 'Италия', nameHy: 'Իտալիա' },
  { iso2: 'ES', iso3: 'ESP', nameEn: 'Spain', nameRu: 'Испания', nameHy: 'Իսպանիա' },
  { iso2: 'PT', iso3: 'PRT', nameEn: 'Portugal', nameRu: 'Португалия', nameHy: 'Պորտուգալիա' },
  { iso2: 'NL', iso3: 'NLD', nameEn: 'Netherlands', nameRu: 'Нидерланды', nameHy: 'Նիդեռլանդներ',
    aliases: ['Holland', 'Голландия'] },
  { iso2: 'BE', iso3: 'BEL', nameEn: 'Belgium', nameRu: 'Бельгия', nameHy: 'Բելգիա' },
  { iso2: 'PL', iso3: 'POL', nameEn: 'Poland', nameRu: 'Польша', nameHy: 'Լեհաստան' },
  { iso2: 'CZ', iso3: 'CZE', nameEn: 'Czech Republic', nameRu: 'Чехия', nameHy: 'Չեխիա',
    aliases: ['Czechia'] },
  { iso2: 'SK', iso3: 'SVK', nameEn: 'Slovakia', nameRu: 'Словакия', nameHy: 'Սլովակիա' },
  { iso2: 'HU', iso3: 'HUN', nameEn: 'Hungary', nameRu: 'Венгрия', nameHy: 'Հունգարիա' },
  { iso2: 'RO', iso3: 'ROU', nameEn: 'Romania', nameRu: 'Румыния', nameHy: 'Ռումինիա' },
  { iso2: 'BG', iso3: 'BGR', nameEn: 'Bulgaria', nameRu: 'Болгария', nameHy: 'Բուլղարիա' },
  { iso2: 'RS', iso3: 'SRB', nameEn: 'Serbia', nameRu: 'Сербия', nameHy: 'Սերբիա' },
  { iso2: 'HR', iso3: 'HRV', nameEn: 'Croatia', nameRu: 'Хорватия', nameHy: 'Խորվաթիա' },
  { iso2: 'SI', iso3: 'SVN', nameEn: 'Slovenia', nameRu: 'Словения', nameHy: 'Սլովենիա' },
  { iso2: 'BA', iso3: 'BIH', nameEn: 'Bosnia and Herzegovina', nameRu: 'Босния и Герцеговина',
    aliases: ['Bosnia'] },
  { iso2: 'ME', iso3: 'MNE', nameEn: 'Montenegro', nameRu: 'Черногория' },
  { iso2: 'MK', iso3: 'MKD', nameEn: 'North Macedonia', nameRu: 'Северная Македония',
    aliases: ['Macedonia', 'Македония'] },
  { iso2: 'AL', iso3: 'ALB', nameEn: 'Albania', nameRu: 'Албания' },
  { iso2: 'GR', iso3: 'GRC', nameEn: 'Greece', nameRu: 'Греция', nameHy: 'Հունաստան' },
  { iso2: 'AT', iso3: 'AUT', nameEn: 'Austria', nameRu: 'Австрия', nameHy: 'Ավստրիա' },
  { iso2: 'CH', iso3: 'CHE', nameEn: 'Switzerland', nameRu: 'Швейцария', nameHy: 'Շվեյցարիա' },
  { iso2: 'IE', iso3: 'IRL', nameEn: 'Ireland', nameRu: 'Ирландия', nameHy: 'Իռլանդիա' },
  { iso2: 'SE', iso3: 'SWE', nameEn: 'Sweden', nameRu: 'Швеция', nameHy: 'Շվեդիա' },
  { iso2: 'NO', iso3: 'NOR', nameEn: 'Norway', nameRu: 'Норвегия', nameHy: 'Նորվեգիա' },
  { iso2: 'FI', iso3: 'FIN', nameEn: 'Finland', nameRu: 'Финляндия', nameHy: 'Ֆինլանդիա' },
  { iso2: 'DK', iso3: 'DNK', nameEn: 'Denmark', nameRu: 'Дания', nameHy: 'Դանիա' },
  { iso2: 'IS', iso3: 'ISL', nameEn: 'Iceland', nameRu: 'Исландия' },
  { iso2: 'TR', iso3: 'TUR', nameEn: 'Turkey', nameRu: 'Турция', nameHy: 'Թուրքիա',
    aliases: ['Türkiye'] },
  { iso2: 'CY', iso3: 'CYP', nameEn: 'Cyprus', nameRu: 'Кипр', nameHy: 'Կիպրոս' },
  { iso2: 'LU', iso3: 'LUX', nameEn: 'Luxembourg', nameRu: 'Люксембург' },
  { iso2: 'MT', iso3: 'MLT', nameEn: 'Malta', nameRu: 'Мальта' },

  // Americas
  { iso2: 'US', iso3: 'USA', nameEn: 'United States', nameRu: 'США', nameHy: 'ԱՄՆ',
    aliases: ['USA', 'America', 'United States of America', 'Соединённые Штаты'] },
  { iso2: 'CA', iso3: 'CAN', nameEn: 'Canada', nameRu: 'Канада', nameHy: 'Կանադա' },
  { iso2: 'MX', iso3: 'MEX', nameEn: 'Mexico', nameRu: 'Мексика', nameHy: 'Մեքսիկա' },
  { iso2: 'BR', iso3: 'BRA', nameEn: 'Brazil', nameRu: 'Бразилия', nameHy: 'Բրազիլիա' },
  { iso2: 'AR', iso3: 'ARG', nameEn: 'Argentina', nameRu: 'Аргентина', nameHy: 'Արգենտինա' },
  { iso2: 'CL', iso3: 'CHL', nameEn: 'Chile', nameRu: 'Чили' },
  { iso2: 'CO', iso3: 'COL', nameEn: 'Colombia', nameRu: 'Колумбия' },
  { iso2: 'PE', iso3: 'PER', nameEn: 'Peru', nameRu: 'Перу' },
  { iso2: 'VE', iso3: 'VEN', nameEn: 'Venezuela', nameRu: 'Венесуэла' },
  { iso2: 'EC', iso3: 'ECU', nameEn: 'Ecuador', nameRu: 'Эквадор' },
  { iso2: 'UY', iso3: 'URY', nameEn: 'Uruguay', nameRu: 'Уругвай' },
  { iso2: 'PY', iso3: 'PRY', nameEn: 'Paraguay', nameRu: 'Парагвай' },
  { iso2: 'BO', iso3: 'BOL', nameEn: 'Bolivia', nameRu: 'Боливия' },

  // Asia / Middle East
  { iso2: 'CN', iso3: 'CHN', nameEn: 'China', nameRu: 'Китай', nameHy: 'Չինաստան' },
  { iso2: 'JP', iso3: 'JPN', nameEn: 'Japan', nameRu: 'Япония', nameHy: 'Ճապոնիա' },
  { iso2: 'KR', iso3: 'KOR', nameEn: 'South Korea', nameRu: 'Южная Корея', nameHy: 'Հարավային Կորեա',
    aliases: ['Korea', 'Republic of Korea'] },
  { iso2: 'IN', iso3: 'IND', nameEn: 'India', nameRu: 'Индия', nameHy: 'Հնդկաստան' },
  { iso2: 'IL', iso3: 'ISR', nameEn: 'Israel', nameRu: 'Израиль', nameHy: 'Իսրայել' },
  { iso2: 'IR', iso3: 'IRN', nameEn: 'Iran', nameRu: 'Иран', nameHy: 'Իրան' },
  { iso2: 'IQ', iso3: 'IRQ', nameEn: 'Iraq', nameRu: 'Ирак' },
  { iso2: 'SA', iso3: 'SAU', nameEn: 'Saudi Arabia', nameRu: 'Саудовская Аравия' },
  { iso2: 'AE', iso3: 'ARE', nameEn: 'United Arab Emirates', nameRu: 'ОАЭ',
    aliases: ['UAE', 'Объединённые Арабские Эмираты'] },
  { iso2: 'EG', iso3: 'EGY', nameEn: 'Egypt', nameRu: 'Египет' },
  { iso2: 'TH', iso3: 'THA', nameEn: 'Thailand', nameRu: 'Таиланд' },
  { iso2: 'VN', iso3: 'VNM', nameEn: 'Vietnam', nameRu: 'Вьетнам' },
  { iso2: 'ID', iso3: 'IDN', nameEn: 'Indonesia', nameRu: 'Индонезия' },
  { iso2: 'PH', iso3: 'PHL', nameEn: 'Philippines', nameRu: 'Филиппины' },
  { iso2: 'MY', iso3: 'MYS', nameEn: 'Malaysia', nameRu: 'Малайзия' },
  { iso2: 'SG', iso3: 'SGP', nameEn: 'Singapore', nameRu: 'Сингапур' },
  { iso2: 'PK', iso3: 'PAK', nameEn: 'Pakistan', nameRu: 'Пакистан' },
  { iso2: 'BD', iso3: 'BGD', nameEn: 'Bangladesh', nameRu: 'Бангладеш' },

  // Oceania
  { iso2: 'AU', iso3: 'AUS', nameEn: 'Australia', nameRu: 'Австралия', nameHy: 'Ավստրալիա' },
  { iso2: 'NZ', iso3: 'NZL', nameEn: 'New Zealand', nameRu: 'Новая Зеландия' },

  // Africa highlights
  { iso2: 'ZA', iso3: 'ZAF', nameEn: 'South Africa', nameRu: 'ЮАР',
    aliases: ['Южно-Африканская Республика'] },
  { iso2: 'MA', iso3: 'MAR', nameEn: 'Morocco', nameRu: 'Марокко' },
  { iso2: 'NG', iso3: 'NGA', nameEn: 'Nigeria', nameRu: 'Нигерия' },
];
