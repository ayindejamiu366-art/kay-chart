// Country -> localized music search queries for personalized homepage
// Maps countries to popular local artists/genres for Spotify search personalization.
export const COUNTRY_MUSIC = {
  'US': ['top hits usa', 'american pop', 'us hip hop'],
  'GB': ['uk top hits', 'british pop', 'uk drill'],
  'IN': ['bollywood hits', 'punjabi', 'tamil hits'],
  'NG': ['naija afrobeats', 'burna boy', 'nigerian hits'],
  'GH': ['ghana afrobeats', 'hiplife', 'ghana highlife', 'azonto'],
  'KE': ['kenyan bongo', 'gengetone'],
  'ZA': ['amapiano', 'kwaito'],
  'BR': ['sertanejo hits', 'pagode', 'mpb'],
  'MX': ['corridos', 'reggaeton mexico', 'latin pop'],
  'CO': ['reggeaton colombia', 'vallenato'],
  'AR': ['cumbia argentina', 'reggaeton argentina'],
  'FR': ['chanson francaise', 'rap francais'],
  'DE': ['deutsche schlager', 'german rap'],
  'ES': ['flamenco', 'reggaeton espanol'],
  'IT': ['pop italiano', 'napoli'],
  'JP': ['j-pop', 'j-rap', 'anison'],
  'KR': ['k-pop', 'k-hip hop'],
  'CN': ['chinese pop', 'mandopop'],
  'PH': ['opm', 'pinoy pop'],
  'ID': ['dangdut', 'indonesian pop'],
  'MY': ['malaysian pop'],
  'TH': ['thai pop', 'thai luk thung'],
  'VN': ['v-pop'],
  'TR': ['turkish pop', 'arabesk'],
  'RU': ['russian pop', 'russian rap'],
  'EG': ['egyptian pop', 'arabic music'],
  'SA': ['arabic pop', 'khaleeji'],
  'AE': ['arabic pop', 'khaleeji'],
  'PK': ['pakistani music', 'qawwali'],
  'BD': ['bangla adhunik', 'bengali band'],
  'LK': ['sri lankan music', 'baila'],
  'NP': ['nepali pop'],
  'AU': ['australian indie', 'aussie rock'],
  'CA': ['canadian hip hop', 'canadian indie'],
  'SE': ['swedish pop'],
  'NO': ['norwegian pop'],
  'FI': ['finnish pop'],
  'DK': ['danish pop'],
  'NL': ['dutch pop', 'dutch hip hop'],
  'PL': ['polish pop', 'polish rap'],
  'UA': ['ukrainian pop'],
  'GR': ['greek pop', 'laiko'],
  'PT': ['fado', 'portuguese pop'],
  'CL': ['cumbia chilena', 'reggaeton chile'],
  'PE': ['cumbia peruana'],
  'VE': ['reggaeton venezuela'],
  'DZ': ['rai', 'algerian pop'],
  'MA': ['moroccan music', 'gnawa'],
  'TN': ['tunisian music'],
  'ET': ['ethiopian music', 'ethio'],
  'TZ': ['bongo flava'],
  'UG': ['ugandan music', 'kadongo kamu'],
};

// Common/latin fallback groupings
const LATIN_COUNTRIES = ['MX','CO','AR','CL','PE','VE','ES','CU','DO','PR'];

export function detectCountry() {
  try {
    // 1. Explicit user preference / stored value
    const stored = localStorage.getItem('nocturne_country');
    if (stored) return stored.toUpperCase();

    // 2. Browser language (e.g. en-GB -> GB)
    if (navigator.language && navigator.language.includes('-')) {
      const cc = navigator.language.split('-')[1].toUpperCase();
      if (cc && cc.length === 2) return cc;
    }

    // 3. Timezone offset heuristic isn't reliable; default to browser timezone region
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      // e.g. "America/New_York" -> US, "Europe/London" -> GB
      if (tz.includes('/')) {
        const region = tz.split('/')[0];
        const city = tz.split('/')[1];
        const map = {
          'America/North_Dakota': 'US', 'America/New_York': 'US', 'America/Chicago': 'US',
          'America/Los_Angeles': 'US', 'America/Denver': 'US',
          'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
          'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL',
          'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Tokyo': 'JP',
          'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Manila': 'PH',
          'Asia/Jakarta': 'ID', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN',
          'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Africa/Lagos': 'NG',
        };
        if (map[`${region}/${city}`]) return map[`${region}/${city}`];
      }
     } catch { /* geolocation unavailable */ }
    return 'US';
  } catch (e) {
    return 'US';
  }
}

export function getCountryName(countryCode) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode;
  } catch { return countryCode; }
}

export function getCountryQueries(countryCode) {
  const cc = (countryCode || 'US').toUpperCase();
  const queries = COUNTRY_MUSIC[cc];
  if (queries) return queries;
  if (LATIN_COUNTRIES.includes(cc)) return ['reggaeton', 'latin pop', 'cumbia'];
  return ['top hits', 'pop hits', 'chart toppers'];
}

// ── Country → Language mapping ──────────────────────────────────────
// Maps ISO 3166-1 alpha-2 country codes to the primary language code (ISO 639-1)
const COUNTRY_LANGUAGE = {
  'US': 'en', 'GB': 'en', 'AU': 'en', 'CA': 'en', 'NZ': 'en', 'IE': 'en',
  'ZA': 'en', 'SG': 'en', 'PH': 'en', 'IN': 'hi', 'PK': 'ur', 'BD': 'bn',
  'LK': 'si', 'NP': 'ne', 'MM': 'my', 'TH': 'th', 'VN': 'vi', 'ID': 'id',
  'MY': 'ms', 'KH': 'km', 'LA': 'lo', 'TL': 'pt',
  'MX': 'es', 'CO': 'es', 'AR': 'es', 'CL': 'es', 'PE': 'es', 'VE': 'es',
  'EC': 'es', 'BO': 'es', 'PY': 'es', 'UY': 'es', 'CU': 'es', 'DO': 'es',
  'PR': 'es', 'GT': 'es', 'HN': 'es', 'SV': 'es', 'NI': 'es', 'CR': 'es',
  'PA': 'es', 'ES': 'es',
  'BR': 'pt', 'PT': 'pt',
  'FR': 'fr', 'BE': 'fr', 'CH': 'fr', 'LU': 'fr', 'MC': 'fr',
  'DE': 'de', 'AT': 'de', 'LI': 'de',
  'IT': 'it', 'SM': 'it',
  'NL': 'nl',
  'SE': 'sv', 'NO': 'nb', 'DK': 'da', 'FI': 'fi', 'IS': 'is',
  'PL': 'pl', 'CZ': 'cs', 'SK': 'sk', 'HU': 'hu', 'RO': 'ro', 'BG': 'bg',
  'HR': 'hr', 'RS': 'sr', 'SI': 'sl', 'BA': 'bs', 'ME': 'sr', 'MK': 'mk',
  'AL': 'sq', 'GR': 'el', 'TR': 'tr', 'UA': 'uk', 'BY': 'be', 'RU': 'ru',
  'EE': 'et', 'LV': 'lv', 'LT': 'lt',
  'JP': 'ja', 'KR': 'ko', 'CN': 'zh', 'TW': 'zh', 'HK': 'zh',
  'SA': 'ar', 'AE': 'ar', 'EG': 'ar', 'DZ': 'ar', 'MA': 'ar', 'TN': 'ar',
  'IQ': 'ar', 'JO': 'ar', 'LB': 'ar', 'KW': 'ar', 'QA': 'ar', 'BH': 'ar',
  'OM': 'ar', 'YE': 'ar', 'LY': 'ar', 'SD': 'ar', 'SY': 'ar', 'PS': 'ar',
  'NG': 'en', 'GH': 'en', 'KE': 'sw', 'TZ': 'sw', 'UG': 'sw', 'ET': 'am',
  'RW': 'rw', 'SN': 'fr', 'CI': 'fr', 'ML': 'fr', 'BF': 'fr', 'NE': 'fr',
   'CM': 'fr', 'CD': 'fr', 'CG': 'fr', 'GA': 'fr', 'MG': 'fr',
  'KZ': 'kk', 'UZ': 'uz', 'AZ': 'az', 'GE': 'ka',
  'IL': 'he',
  'IR': 'fa',
};

// Language code → human-readable language name (for the prompt)
const LANGUAGE_NAMES = {
  'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian',
  'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese',
  'ar': 'Arabic', 'hi': 'Hindi', 'tr': 'Turkish', 'nl': 'Dutch', 'sv': 'Swedish',
  'pl': 'Polish', 'vi': 'Vietnamese', 'th': 'Thai', 'id': 'Indonesian', 'ms': 'Malay',
  'bn': 'Bengali', 'ur': 'Urdu', 'fa': 'Persian', 'he': 'Hebrew', 'uk': 'Ukrainian',
  'cs': 'Czech', 'ro': 'Romanian', 'el': 'Greek', 'hu': 'Hungarian', 'da': 'Danish',
  'fi': 'Finnish', 'nb': 'Norwegian', 'bg': 'Bulgarian', 'hr': 'Croatian', 'sr': 'Serbian',
  'sk': 'Slovak', 'sl': 'Slovenian', 'et': 'Estonian', 'lv': 'Latvian', 'lt': 'Lithuanian',
  'sw': 'Swahili', 'am': 'Amharic', 'ka': 'Georgian', 'az': 'Azerbaijani',
  'kk': 'Kazakh', 'uz': 'Uzbek', 'si': 'Sinhala', 'ne': 'Nepali', 'my': 'Burmese',
  'km': 'Khmer', 'lo': 'Lao', 'sq': 'Albanian', 'bs': 'Bosnian', 'mk': 'Macedonian',
  'rw': 'Kinyarwanda', 'be': 'Belarusian', 'is': 'Icelandic',
};

// Language codes that have local translation files
const LOCAL_LANG_CODES = ['en', 'ar', 'es', 'fr', 'hi', 'ta'];

/**
 * Detect the user's primary language from their country code.
 * Returns { code, name, isSupported }
 */
export function detectLanguage(countryCode) {
  const cc = (countryCode || 'US').toUpperCase();
  const code = COUNTRY_LANGUAGE[cc] || 'en';
  return {
    code,
    name: LANGUAGE_NAMES[code] || code,
    isSupported: LOCAL_LANG_CODES.includes(code),
  };
}

