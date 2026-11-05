import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from '../i18n/translations/en';
import { translateDictionary, hasLocalTranslation } from '../services/translator';

const I18nContext = createContext();

const I18N_KEY = 'nocturne_language';
const RTL_LANGS = ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'arc', 'ckb', 'mzn'];

function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => params[key] !== undefined ? params[key] : `{${key}}`);
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(I18N_KEY) || 'en'; } catch { return 'en'; }
  });

  const [translations, setTranslations] = useState({ en });
  const [langVersion, setLangVersion] = useState(0);
  const [translating, setTranslating] = useState(false);

  const setLang = useCallback(async (code) => {
    setLangState(code);
    try { localStorage.setItem(I18N_KEY, code); } catch {} // eslint-disable-line no-empty

    if (code === 'en') {
      setTranslations({ en });
      setLangVersion(v => v + 1);
      return;
    }

    // 1. Try loading local translation file
    if (hasLocalTranslation(code)) {
      try {
        const mod = await import(`../i18n/translations/${code}.js`);
        setTranslations({ en, [code]: mod.default || mod[code] });
        setLangVersion(v => v + 1);
      } catch {
        setTranslations({ en });
        setLangVersion(v => v + 1);
      }
      return;
    }

    // 2. No local file — use runtime translation via Google Translate
    setTranslating(true);
    try {
      const dict = await translateDictionary(code, en);
      if (dict && Object.keys(dict).length > 0) {
        setTranslations({ en, [code]: dict });
      } else {
        setTranslations({ en });
      }
    } catch (e) {
      console.warn('Runtime translation failed:', e.message);
      setTranslations({ en });
    }
    setTranslating(false);
    setLangVersion(v => v + 1);
  }, []);

  // On mount, translate if current lang has no local file
  useEffect(() => {
    if (lang !== 'en' && !hasLocalTranslation(lang)) {
      setLang(lang);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const isRtl = RTL_LANGS.includes(lang);
    root.dir = isRtl ? 'rtl' : 'ltr';
    root.lang = lang;
  }, [lang]);

  const t = useCallback((key, params) => {
    const currentLang = lang === 'en' ? null : translations[lang];
    const val = (currentLang && currentLang[key]) || en[key] || key;
    return interpolate(val, params);
  }, [lang, translations]);

  const isRtl = RTL_LANGS.includes(lang);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isRtl, langVersion, translating }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
