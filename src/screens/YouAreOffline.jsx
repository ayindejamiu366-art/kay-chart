import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';

export default function YouAreOffline() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      <div className="ambient-glow ambient-glow-animated" />
      <header className="flex justify-between items-center px-6 py-4 z-10">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-primary">{t('OFFLINE_BRAND')}</span>
        </div>
        <button className="text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-[60px] animate-pulse" />
          <div className="w-48 h-48 relative flex items-center justify-center">
            <span className="material-symbols-outlined text-[100px] text-primary/70" style={{ fontVariationSettings: "'FILL' 1" }}>wifi_off</span>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-on-surface text-center mb-3" style={{ textShadow: '0 0 30px rgba(214,255,61,0.3)' }}>
          {t('OFFLINE_HEADING')}
        </h1>
        <p className="text-base text-on-surface-variant text-center max-w-xs mb-8">
          {t('OFFLINE_DESCRIPTION')}
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => navigate('/downloads')} className="bg-primary hover:bg-primary-hover rounded-full h-12 flex items-center justify-center font-semibold text-background active:scale-95 transition-all shadow-[0_0_20px_rgba(214,255,61,0.3)]">
            {t('OFFLINE_GO_DOWNLOADS')}
          </button>
          <button onClick={() => window.location.reload()} className="border border-on-surface/20 rounded-full h-12 flex items-center justify-center text-on-surface/80 hover:bg-surface-card-hover transition-colors active:scale-95">
            {t('OFFLINE_TRY_AGAIN')}
          </button>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 w-full h-20 flex justify-around items-center px-4 pb-4 bg-surface-dim/80 backdrop-blur-xl border-t border-border-subtle z-50 rounded-t-[20px]">
        <button onClick={() => navigate('/')} className="flex flex-col items-center justify-center text-on-surface-variant/60 p-2 hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined mb-1">home</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold">{t('NAV_HOME')}</span>
        </button>
        <button onClick={() => navigate('/search')} className="flex flex-col items-center justify-center text-on-surface-variant/60 p-2 hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined mb-1">search</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold">{t('NAV_SEARCH')}</span>
        </button>
        <button onClick={() => navigate('/library')} className="flex flex-col items-center justify-center text-background bg-primary rounded-full p-3 -mt-4 shadow-[0_0_20px_rgba(214,255,61,0.3)]">
          <span className="material-symbols-outlined mb-1 icon-fill">library_music</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold">Library</span>
        </button>
      </nav>
    </div>
  );
}
