import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { hasLocalTranslation } from '../services/translator';
import LANGUAGES, { EXTRA_LANGUAGES } from '../i18n/languages';

const ALL_LANGS = [...LANGUAGES, ...EXTRA_LANGUAGES].reduce((acc, lang) => {
  if (!acc.find(l => l.code === lang.code)) acc.push(lang);
  return acc;
}, []).sort((a, b) => a.name.localeCompare(b.name));

export default function LanguagePicker() {
  const navigate = useNavigate();
  const { lang: currentLang, setLang, t } = useI18n();
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState('');
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_LANGS;
    const q = search.toLowerCase();
    return ALL_LANGS.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  }, [search]);

  const handleSelect = async (code) => {
    if (code === currentLang) { navigate(-1); return; }
    setSaving(true);
    setSavingMsg(hasLocalTranslation(code) ? 'Loading translation...' : 'Translating app to your language...');
    await setLang(code);
    setTimeout(() => {
      setSaving(false);
      navigate(-1);
    }, 500);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden page-enter">
      <div className="ambient-glow ambient-glow-animated" />

      {/* Header */}
      <div className="relative z-10 px-6 pt-14 pb-3 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center press-feedback">
          <span className="material-symbols-outlined text-on-surface text-[20px]">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="font-headline-md text-headline-md text-on-surface">{t('PROFILE_ITEM_LANGUAGE')}</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">{ALL_LANGS.length} languages available</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative z-10 px-6 pb-3">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
          <input
            ref={inputRef}
            type="text"
            placeholder={t('SEARCH')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-12 pl-11 pr-10 rounded-2xl bg-surface-card border border-border-subtle text-on-surface text-body-md placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 focus:bg-primary/5 transition-all"
            autoFocus
          />
          {search && (
            <button onClick={() => { setSearch(''); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-[14px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Access: Top Languages */}
      {!search && (
        <div className="relative z-10 px-6 pb-3">
          <p className="font-label-lg text-label-lg text-on-surface-variant/60 uppercase tracking-wider text-[10px] mb-2">Popular</p>
          <div className="flex gap-2 flex-wrap">
            {['en', 'es', 'fr', 'ar', 'hi', 'zh', 'ja', 'ko', 'pt', 'de', 'ta', 'tr'].map(code => {
              const lang = ALL_LANGS.find(l => l.code === code);
              if (!lang) return null;
              const active = currentLang === code;
              return (
                <button
                  key={code}
                  onClick={() => handleSelect(code)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-card text-on-surface border-border-subtle hover:border-primary/40'}`}
                >
                  {lang.native}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Language List */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-28 hide-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="material-symbols-outlined text-on-surface-variant/30 text-[48px] mb-3">translate</span>
            <p className="text-on-surface-variant text-body-md">{t('NO_RESULTS')}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((lang, i) => {
              const active = currentLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left ${active ? 'bg-primary/10 border border-primary/30' : 'hover:bg-surface-card-hover border border-transparent'}`}
                  style={{ animationDelay: `${Math.min(i * 15, 300)}ms` }}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${active ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                    {lang.code.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-body-md text-body-md truncate ${active ? 'text-primary font-semibold' : 'text-on-surface'}`}>{lang.name}</p>
                      {lang.rtl && <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">RTL</span>}
                    </div>
                    <p className="font-body-xs text-body-xs text-on-surface-variant truncate">{lang.native}</p>
                  </div>
                  {active && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>
                    </div>
                  )}
                  {!active && (
                    <span className="material-symbols-outlined text-on-surface-variant/30 text-[18px] shrink-0">chevron_right</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {saving && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-on-surface-variant text-body-sm">{savingMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
