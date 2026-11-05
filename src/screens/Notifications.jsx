import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { useI18n } from '../context/I18nContext';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';
import { SkeletonTrackList } from '../components/skeleton';

export default function Notifications() {
  const navigate = useNavigate();
  const { t } = useI18n();
  // Real first-load signal for the notifications request. Cleared when that
  // request settles either way, so the unread badge, mark-as-read actions and
  // the existing empty state all behave exactly as before once loaded.
  const { notifications, markNotificationRead, markAllNotificationsRead, collectionsLoading } = useApp();

  const unread = notifications.filter(n => !n.read).length;
  const listRef = useRef(null);

  useEffect(() => {
    if (prefersReduced || !listRef.current || notifications.length === 0) return;
    const items = listRef.current.querySelectorAll('[data-notif]');
    gsap.fromTo(items,
      { x: -20, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.35, stagger: 0.04, ease: 'power3.out', overwrite: 'auto', delay: 0.1 }
    );
  }, [notifications.length]);

  const handleTap = (notif) => {
    markNotificationRead(notif.id);
    if (notif.targetId) {
      if (notif.targetId.startsWith('al')) navigate(`/album/${notif.targetId}`);
      else if (notif.targetId.startsWith('pl')) navigate('/liked-songs');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'release': return 'new_releases';
      case 'upload': return 'upload';
      case 'follow': return 'person_add';
      case 'ai': return 'auto_awesome';
      case 'social': return 'group';
      default: return 'notifications';
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'ai': return 'bg-gradient-to-r from-[#D6FF3D] to-[#9FE81F]';
      case 'release': return 'bg-primary/15';
      case 'upload': return 'bg-green-500/15';
      case 'follow': return 'bg-blue-500/15';
      default: return 'bg-surface-card';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden">
      <div className="ambient-glow ambient-glow-animated" />
      <header className="w-full sticky top-0 z-40 bg-background/70 backdrop-blur-xl flex justify-between items-center px-6 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-on-surface text-lg font-semibold">{t('NOTIF_HEADING')}</h1>
        </div>
        {unread > 0 && (
          <button onClick={markAllNotificationsRead} className="text-primary text-sm font-semibold hover:opacity-80 transition-opacity">
            Mark all read
          </button>
        )}
      </header>

        <div className="flex-1 overflow-y-auto relative z-10">
          {/* Skeleton first so an empty inbox is never confused with a pending
              request. The unread count in the header is left alone. */}
          {collectionsLoading ? (
            <div className="px-6">
              <SkeletonTrackList rows={6} artworkSize={40} />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <span className="material-symbols-outlined text-on-surface-variant/40 text-[64px] mb-4">notifications_none</span>
              <p className="text-lg font-semibold text-on-surface mb-2">{t('NOTIF_EMPTY_HEADING')}</p>
              <p className="text-sm text-on-surface-variant">{t('NOTIF_EMPTY_DESC')}</p>
            </div>
          ) : (
              <>
              <div ref={listRef} className="px-6">
              {notifications.map(notif => (
                <button
                  key={notif.id}
                  data-notif
                  onClick={() => handleTap(notif)}
                  className={`w-full flex items-start gap-3 p-4 rounded-2xl transition-colors text-left ${
                    notif.read ? 'hover:bg-surface-card-hover' : 'bg-surface-card border border-border-subtle hover:bg-surface-card'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getIconColor(notif.type)}`}>
                    {notif.type === 'ai' ? (
                      <span className="material-symbols-outlined text-background text-[18px] icon-fill">{getIcon(notif.type)}</span>
                    ) : (
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">{getIcon(notif.type)}</span>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      {!notif.read && <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(214,255,61,0.6)]" />}
                      <p className="text-sm font-semibold text-on-surface truncate">{notif.title}</p>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-0.5">{notif.body}</p>
                    <p className="text-xs text-on-surface-variant/50 mt-1">{notif.time}</p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/50 text-[16px] shrink-0">chevron_right</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
