import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';

const SUPPORT_EMAIL = 'ayindejamiu366@gmail.com';
const WHATSAPP_NUMBER = '+2347068432863';

export default function Support() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const openEmail = () => {
    window.open(`mailto:${SUPPORT_EMAIL}?subject=Kay%20Chart%20Support%20Request`, '_blank');
  };

  const openWhatsApp = () => {
    const msg = encodeURIComponent('Hi, I need help with Kay Chart.');
    window.open(`https://wa.me/${WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden page-enter">
      <div className="ambient-glow ambient-glow-animated" />

      {/* Header */}
      <div className="relative z-10 px-6 pt-14 pb-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center press-feedback">
          <span className="material-symbols-outlined text-on-surface text-[20px]">arrow_back</span>
        </button>
        <h1 className="font-headline-md text-headline-md text-on-surface">{t('SUPPORT_HEADING')}</h1>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-28 hide-scrollbar">
        {/* Hero */}
        <div className="flex flex-col items-center text-center py-8 fade-up fade-up-1">
          <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-primary text-[36px]">headset_mic</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">{t('SUPPORT_TITLE')}</h2>
          <p className="text-body-sm text-on-surface-variant max-w-xs">{t('SUPPORT_DESCRIPTION')}</p>
        </div>

        {/* Contact Options */}
        <div className="flex flex-col gap-3 mb-6 fade-up fade-up-2">
          {/* Email */}
          <button
            onClick={openEmail}
            className="flex items-center gap-4 p-4 rounded-2xl bg-surface-card border border-border-subtle hover:bg-surface-card-hover transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-red-400 text-[24px]">mail</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body-md text-body-md text-on-surface font-medium">{t('SUPPORT_EMAIL')}</p>
              <p className="font-body-xs text-body-xs text-on-surface-variant truncate">{SUPPORT_EMAIL}</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/40 text-[20px]">open_in_new</span>
          </button>

          {/* WhatsApp */}
          <button
            onClick={openWhatsApp}
            className="flex items-center gap-4 p-4 rounded-2xl bg-surface-card border border-border-subtle hover:bg-surface-card-hover transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-green-400 text-[24px]">chat</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body-md text-body-md text-on-surface font-medium">{t('SUPPORT_WHATSAPP')}</p>
              <p className="font-body-xs text-body-xs text-on-surface-variant">{WHATSAPP_NUMBER}</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/40 text-[20px]">open_in_new</span>
          </button>
        </div>

        {/* FAQ Section */}
        <div className="fade-up fade-up-3">
          <h3 className="font-label-lg text-label-lg text-on-surface-variant/60 uppercase tracking-wider text-[10px] mb-3">{t('SUPPORT_FAQ')}</h3>
          <div className="flex flex-col gap-2">
            {[
              { q: t('SUPPORT_FAQ_Q1'), a: t('SUPPORT_FAQ_A1') },
              { q: t('SUPPORT_FAQ_Q2'), a: t('SUPPORT_FAQ_A2') },
              { q: t('SUPPORT_FAQ_Q3'), a: t('SUPPORT_FAQ_A3') },
              { q: t('SUPPORT_FAQ_Q4'), a: t('SUPPORT_FAQ_A4') },
            ].map((faq, i) => (
              <details key={i} className="group rounded-xl bg-surface-card border border-border-subtle overflow-hidden">
                <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer list-none hover:bg-surface-card-hover transition-colors">
                  <span className="font-body-md text-body-md text-on-surface pr-2">{faq.q}</span>
                  <span className="material-symbols-outlined text-on-surface-variant/40 text-[20px] shrink-0 transition-transform group-open:rotate-180">expand_more</span>
                </summary>
                <div className="px-4 pb-4 border-t border-border-subtle">
                  <p className="font-body-sm text-body-sm text-on-surface-variant pt-3 leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
