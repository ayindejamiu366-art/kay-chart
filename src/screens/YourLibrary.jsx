import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { useI18n } from '../context/I18nContext';
import { playlists, songs, getPlaylistSongs } from '../data/library';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';
import { SkeletonLibraryList } from '../components/skeleton';

export default function YourLibrary() {
  const navigate = useNavigate();
  // `collectionsLoading` is the real first-load signal for the context-backed
  // data this screen renders (playlists, downloads). It is already true on
  // mount and clears when the request settles, so no timer is involved, and it
  // is never re-armed afterwards, so a background refresh keeps the real list on
  // screen rather than flashing a skeleton over it.
  const { userPlaylists, downloads, isAdmin, isArtist, likedSongs, audio, collectionsLoading } = useApp();
  const { t } = useI18n();
  const [activeFilter, setActiveFilter] = useState('Playlists');
  const filters = [
    { key: 'Playlists', label: t('LIBRARY_FILTER_PLAYLISTS') },
    { key: 'Artists', label: t('LIBRARY_FILTER_ARTISTS') },
    { key: 'Albums', label: t('LIBRARY_FILTER_ALBUMS') },
    { key: 'Downloaded', label: t('LIBRARY_FILTER_DOWNLOADED') },
  ];

  const allPlaylists = [...playlists, ...userPlaylists];
  const downloadedIds = new Set(downloads.map(d => d.id));
  const downloadedSongs = songs.filter(s => downloadedIds.has(s.id));

  const getItems = () => {
    switch (activeFilter) {
      case 'Playlists': return allPlaylists.map(p => ({ ...p, type: 'playlist', playableSongs: getPlaylistSongs(p.id) }));
      case 'Artists': return [
        { id: 'a1', name: 'Anirudh Ravichander', type: 'artist', route: '/artist/a1', subtitle: '12.5M listeners' },
        { id: 'a2', name: 'Yuvan Shankar Raja', type: 'artist', route: '/artist/a2', subtitle: '8.2M listeners' },
        { id: 'a3', name: 'Ilaiyaraaja', type: 'artist', route: '/artist/a3', subtitle: '6.7M listeners' },
        { id: 'a4', name: 'Kavinsky', type: 'artist', route: '/artist/a4', subtitle: '4.5M listeners' },
        { id: 'a5', name: 'The Weeknd', type: 'artist', route: '/artist/a5', subtitle: '15.6M listeners' },
        { id: 'a6', name: 'Wizkid', type: 'artist', route: '/artist/a6', subtitle: '14.2M listeners' },
        { id: 'a7', name: 'Burna Boy', type: 'artist', route: '/artist/a7', subtitle: '13.6M listeners' },
        { id: 'a8', name: 'Davido', type: 'artist', route: '/artist/a8', subtitle: '12.1M listeners' },
        { id: 'a12', name: 'Central Cee', type: 'artist', route: '/artist/a12', subtitle: '11.5M listeners' },
        { id: 'a13', name: 'Dave', type: 'artist', route: '/artist/a13', subtitle: '10.2M listeners' },
      ];
      case 'Albums': return [
        { id: 'al1', name: 'Leo OST', type: 'album', route: '/album/al1', subtitle: 'Anirudh · 2023' },
        { id: 'al9', name: 'Made in Lagos', type: 'album', route: '/album/al9', subtitle: 'Wizkid · 2020' },
        { id: 'al12', name: 'African Giant', type: 'album', route: '/album/al12', subtitle: 'Burna Boy · 2019' },
        { id: 'al17', name: 'Rave & Roses', type: 'album', route: '/album/al17', subtitle: 'Rema · 2022' },
        { id: 'al22', name: "We're All Alone in This Together", type: 'album', route: '/album/al22', subtitle: 'Dave · 2021' },
      ];
      case 'Downloaded': return downloadedSongs.map(s => ({ id: s.id, name: s.title, type: 'song', subtitle: s.artistName, cover: s.cover, playSongs: [s], play: true }));
      default: return [];
    }
  };

  const items = getItems();
  const listRef = useRef(null);

  useEffect(() => {
    if (prefersReduced || !listRef.current || items.length === 0) return;
    const els = listRef.current.querySelectorAll('[data-item]');
    gsap.fromTo(els,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.35, stagger: 0.04, ease: 'power3.out', overwrite: 'auto', delay: 0.1 }
    );
  }, [items.length, activeFilter]);

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl flex justify-between items-center px-6 h-16 border-b border-border-subtle fade-up">
        <div className="flex items-center gap-4">
          <h1 className="font-headline-md text-headline-md text-primary tracking-tight">{t('LIBRARY_HEADING')}</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/create-playlist')} className="hover:bg-surface-card-hover p-2 rounded-full text-on-surface-variant transition-colors press-feedback">
            <span className="material-symbols-outlined">add</span>
          </button>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-medium bg-primary-container/40 flex items-center justify-center" onClick={() => navigate('/profile')}>
            <span className="material-symbols-outlined icon-fill text-primary text-[18px]">person</span>
          </div>
        </div>
      </header>

      <main className="flex-grow px-6 pt-6 pb-28 fade-up-1">
        {/* Artist / Admin Quick Links */}
        {(isArtist || isAdmin) && (
          <div className="flex gap-3 mb-4 fade-up fade-up-1">
            {isArtist && (
              <button onClick={() => navigate('/upload')} className="flex-1 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center gap-2 text-primary font-body-sm text-body-sm hover:bg-primary/20 transition-colors press-feedback">
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                {t('LIBRARY_UPLOAD_MUSIC')}
              </button>
            )}
            {isAdmin && (
              <button onClick={() => navigate('/admin')} className="flex-1 h-12 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center gap-2 text-secondary font-body-sm text-body-sm hover:bg-secondary/20 transition-colors press-feedback">
                <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                {t('LIBRARY_ADMIN_PANEL')}
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4">
          {filters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)} className={`press-feedback px-4 py-2 rounded-full font-body-sm text-body-sm whitespace-nowrap transition-colors ${
              activeFilter === f.key ? 'bg-primary text-background' : 'bg-surface-card text-on-surface-variant border border-border-subtle'
            }`}>{f.label}</button>
          ))}
        </div>

        {activeFilter === 'Playlists' && (
          <div className="p-4 rounded-2xl bg-surface-card border border-primary/20 flex items-center gap-4 mb-3 cursor-pointer hover:border-primary/40 hover:bg-surface-card-hover transition-all fade-up-2" onClick={() => navigate('/liked-songs')}>
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#D6FF3D] to-[#9FE81F] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(214,255,61,0.25)]">
              <span className="material-symbols-outlined text-background text-[32px] icon-fill">favorite</span>
            </div>
            <div className="flex-grow">
              <h3 className="font-headline-md text-headline-md text-on-background mb-1">{t('LIBRARY_LIKED_SONGS')}</h3>
              <div className="flex items-center text-on-surface-variant font-body-sm text-body-sm gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary icon-fill">push_pin</span>
                <span>Playlist · {likedSongs.length} songs</span>
              </div>
            </div>
          </div>
        )}

        {/* Only the first load is skeletonised, and only the list body. The
            header, the artist/admin links and the filter chips are real
            interactive navigation, so they stay usable while data arrives. */}
        <div ref={listRef} className="grid grid-cols-1 gap-3 mt-4 fade-up-3">
          {collectionsLoading ? (
            <SkeletonLibraryList rows={6} />
          ) : items.filter(item => activeFilter === 'Playlists' && item.id === 'pl1' ? false : true).map(item => (
            <div
              key={item.id}
              data-item
              onClick={() => {
                if (item.playSongs && item.playSongs.length > 0) {
                  audio.play(item.playSongs[0], item.playSongs);
                } else if (item.playableSongs && item.playableSongs.length > 0) {
                  audio.play(item.playableSongs[0], item.playableSongs);
                } else if (item.route) {
                  navigate(item.route);
                }
              }}
              className="p-4 rounded-2xl bg-surface-card border border-border-subtle flex items-center gap-4 cursor-pointer hover:bg-surface-card-hover hover:border-medium transition-all press-feedback"
            >
              {item.type === 'artist' ? (
                <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-primary/20 bg-surface-container">
                  <span className="material-symbols-outlined text-on-surface-variant text-[24px] flex items-center justify-center w-full h-full">person</span>
                </div>
              ) : item.cover ? (
                <img src={item.cover} alt={item.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-surface-card-hover flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant text-[24px]">music_note</span>
                </div>
              )}
              <div className="flex-grow min-w-0">
                <h3 className="font-headline-md text-headline-md text-on-background mb-1 truncate">{item.name || item.title}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {item.subtitle || `${item.type === 'playlist' ? 'Playlist' : item.type === 'album' ? 'Album' : 'Artist'} · ${item.songIds ? item.songIds.length + ' songs' : ''}`}
                </p>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="flex flex-col items-center py-16">
              <span className="material-symbols-outlined text-on-surface-variant text-[48px] mb-3">
                {activeFilter === 'Downloaded' ? 'download_done' : 'library_music'}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {activeFilter === 'Downloaded' ? t('LIBRARY_NO_DOWNLOADED') : t('LIBRARY_NOTHING_HERE')}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
