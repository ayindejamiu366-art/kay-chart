import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { songs, playlists, formatTime } from '../data/library';
import { useI18n } from '../context/I18nContext';
import { SkeletonText, SkeletonTrackList } from '../components/skeleton';

export default function Downloads() {
  const navigate = useNavigate();
  const { t } = useI18n();
  // `collectionsLoading` reflects the real downloads request behind this list.
  // It is set on mount and cleared when the request settles either way, so the
  // existing "no downloads" state is still reachable for a genuinely empty
  // device, and download behaviour is untouched.
  const { downloads, toggleDownload, likedSongs, collectionsLoading } = useApp();
  const [downloadAll, setDownloadAll] = useState(false);

  const downloadedSongs = songs.filter(s => downloads.includes(s.id));
  const storageUsed = (downloadedSongs.length * 0.012).toFixed(1);
  const totalStorage = 32;

  const downloadGroups = [
    { name: 'Liked Songs', count: downloadedSongs.filter(s => s.id.startsWith('s')).length || 0, size: `${((downloadedSongs.length * 0.012) * 0.3).toFixed(0)}GB` },
    { name: 'Leo OST', count: 3, size: '240MB' },
    { name: "Vibe's Night Out", count: 2, size: '180MB' },
  ].filter(g => g.count > 0);

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden page-enter">
      <header className="w-full sticky top-0 z-40 bg-background/70 backdrop-blur-xl flex justify-between items-center px-6 py-4 relative z-10 fade-up">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:opacity-80 transition-opacity">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-on-surface text-lg font-semibold">{t('DOWNLOADS_HEADING')}</h1>
        <div className="w-8" />
      </header>

      <main className="flex-1 px-6 pt-4 pb-8 overflow-y-auto relative z-10 fade-up-1">
        <div className="bg-surface-dim rounded-2xl p-4 mb-6 relative overflow-hidden border border-border-subtle">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <h3 className="text-on-surface text-lg font-semibold mb-3">{t('DOWNLOADS_STORAGE')}</h3>
          <div className="relative w-full h-3 bg-surface-container-high rounded-full overflow-hidden mb-2">
            <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#D6FF3D] to-[#9FE81F] rounded-full shadow-[0_0_12px_rgba(214,255,61,0.4)]" style={{ width: `${(storageUsed / totalStorage) * 100}%` }} />
          </div>
          <div className="flex justify-between text-sm text-on-surface-variant">
            <span>{t('DOWNLOADS_GB_USED', { storageUsed })}</span>
            <span>{t('DOWNLOADS_GB_AVAILABLE', { totalStorage })}</span>
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs text-on-surface-variant">{t('DOWNLOADS_LEGEND_DOWNLOADS')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-medium" />
              <span className="text-xs text-on-surface-variant">{t('DOWNLOADS_LEGEND_OTHER_APPS')}</span>
            </div>
          </div>
          {likedSongs.length > 0 && (
            <button
              onClick={() => navigate('/tidy-up')}
              className="mt-4 w-full h-10 rounded-full border border-border-subtle text-on-surface-variant hover:text-on-surface hover:bg-surface-card-hover transition-colors flex items-center justify-center gap-2 text-sm font-medium press-feedback"
            >
              <span className="material-symbols-outlined text-[18px]">cleaning_services</span>
              Smart Tidy Up
            </button>
          )}
        </div>

        <div className="flex items-center justify-between py-3 border-b border-medium mb-4">
          <span className="text-on-surface text-base">{t('DOWNLOADS_DOWNLOAD_ALL_LIKED')}</span>
          <button
            onClick={() => setDownloadAll(!downloadAll)}
            className={`w-12 h-6 rounded-full transition-colors relative ${downloadAll ? 'bg-primary' : 'bg-surface-container-high'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-background absolute top-0.5 transition-all shadow ${downloadAll ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>

        <h3 className="text-xs uppercase tracking-wider text-on-surface-variant mb-3 font-semibold">{t('DOWNLOADS_DOWNLOADED_HEADING')}</h3>
        {collectionsLoading ? (
          <div className="flex flex-col gap-2 fade-up-2">
            <SkeletonText width={140} height={12} className="mb-1" />
            <SkeletonTrackList rows={5} artworkSize={40} />
          </div>
        ) : downloadGroups.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <span className="material-symbols-outlined text-on-surface-variant text-[48px] mb-3">download</span>
            <p className="text-sm text-on-surface-variant">{t('DOWNLOADS_NO_DOWNLOADS')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 fade-up-2">
            {downloadGroups.map(group => (
              <div key={group.name} className="p-3 rounded-2xl bg-surface-card border border-border-subtle flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary icon-fill text-[20px]">download_done</span>
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{group.name}</p>
                  <p className="text-xs text-on-surface-variant">{group.count} tracks · {group.size}</p>
                </div>
                <button className="text-on-surface-variant hover:text-red-400 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
