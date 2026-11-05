import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { formatTime } from '../data/library';
import api from '../services/api';
import { Skeleton, SkeletonText, SkeletonCircle } from '../components/skeleton';

const TABS = ['Pending Uploads', 'Users', 'All Tracks'];

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, isAdmin, allSongs } = useApp();
  const [activeTab, setActiveTab] = useState('Pending Uploads');
  const [users, setUsers] = useState([]);
  const [pendingSongs, setPendingSongs] = useState([]);
  const [stats, setStats] = useState({ totalTracks: 0, totalUsers: 0, totalPending: 0 });
  // Tracks the real admin request. `loadData` is only re-run when `allSongs`
  // changes, so this stays true for the first load and settles afterwards; the
  // authorisation check below is untouched and still runs first.
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, pendingRes] = await Promise.allSettled([
        api.getAllUsers(),
        api.getPendingSongs(),
      ]);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.users || []);
      if (pendingRes.status === 'fulfilled') setPendingSongs(pendingRes.value.songs || []);
      setStats({
        totalTracks: allSongs.length,
        totalUsers: usersRes.status === 'fulfilled' ? (usersRes.value.users || []).length : 0,
        totalPending: pendingRes.status === 'fulfilled' ? (pendingRes.value.songs || []).length : 0,
      });
    } catch (err) {
      console.error('Admin load failed:', err);
    } finally {
      // `finally` so a failed request also ends the loading state; a skeleton
      // must never persist because an admin fetch errored.
      setLoading(false);
    }
  }, [allSongs]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background page-enter px-6">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">admin_panel_settings</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Admin Access Required</h1>
        <p className="font-body-md text-body-md text-on-surface-variant text-center mb-6">
          You need admin privileges to access this panel. Sign in with the admin account.
        </p>
        <button onClick={() => navigate('/sign-in')} className="btn-primary rounded-full px-8 py-3">
          Sign In
        </button>
      </div>
    );
  }

  const handleApprove = async (id) => {
    await api.approveSong(id);
    loadData();
  };

  const handleReject = async (id) => {
    await api.rejectSong(id);
    loadData();
  };

  const handleDelete = async (id) => {
    await api.deleteSong(id);
    loadData();
  };

  const handleRoleChange = async (userId, newRole) => {
    await api.updateRole(userId, newRole);
    loadData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background page-enter">
      <header className="flex items-center gap-4 w-full px-6 py-4 bg-background/70 backdrop-blur-xl">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Admin Panel</h1>
      </header>

      {/* Stats. The tiles keep their real shape while loading so the counts do
          not move when they arrive — the numbers themselves are never invented,
          only their box is reserved. */}
      <div className="px-6 py-4 grid grid-cols-3 gap-3">
        <div className="bg-surface-card rounded-2xl p-3 text-center border border-border-subtle">
          {loading
            ? <Skeleton width={38} height={20} radius="6px" className="mx-auto mb-1.5" />
            : <p className="font-headline-md text-headline-md text-primary">{stats.totalTracks}</p>}
          <p className="font-body-xs text-body-xs text-on-surface-variant">Tracks</p>
        </div>
        <div className="bg-surface-card rounded-2xl p-3 text-center border border-border-subtle">
          {loading
            ? <Skeleton width={38} height={20} radius="6px" className="mx-auto mb-1.5" />
            : <p className="font-headline-md text-headline-md text-secondary">{stats.totalUsers}</p>}
          <p className="font-body-xs text-body-xs text-on-surface-variant">Users</p>
        </div>
        <div className="bg-surface-card rounded-2xl p-3 text-center border border-border-subtle">
          {loading
            ? <Skeleton width={38} height={20} radius="6px" className="mx-auto mb-1.5" />
            : <p className="font-headline-md text-headline-md text-tertiary">{stats.totalPending}</p>}
          <p className="font-body-xs text-body-xs text-on-surface-variant">Pending</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-6 pb-4">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full font-body-sm text-body-sm transition-all press-feedback ${activeTab === tab ? 'bg-primary text-background' : 'bg-surface-card text-on-surface-variant hover:bg-surface-card-hover'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-28">
        {activeTab === 'Pending Uploads' && (
          <div className="flex flex-col gap-3">
            {/* Skeleton before the empty state, so "still loading" is never shown
                as "no pending uploads". */}
            {loading
              ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="bg-surface-card rounded-2xl p-4 border border-border-subtle flex items-center gap-4">
                  <Skeleton width={48} height={48} radius="rounded-xl" className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <SkeletonText width="54%" height={14} className="mb-2" />
                    <SkeletonText width="34%" height={11} />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <SkeletonCircle size={36} />
                    <SkeletonCircle size={36} />
                  </div>
                </div>
              ))
              : pendingSongs.length === 0 && (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-3">check_circle</span>
                  <p className="text-on-surface-variant">No pending uploads</p>
                </div>
              )}
            {!loading && pendingSongs.map(song => (
              <div key={song.id} className="bg-surface-card rounded-2xl p-4 border border-border-subtle flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">music_note</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body-md text-body-md text-on-surface truncate">{song.title}</p>
                  <p className="font-body-xs text-body-xs text-on-surface-variant truncate">{song.artist_name}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(song.id)} className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center press-feedback">
                    <span className="material-symbols-outlined text-green-400 text-[18px]">check</span>
                  </button>
                  <button onClick={() => handleReject(song.id)} className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center press-feedback">
                    <span className="material-symbols-outlined text-red-400 text-[18px]">close</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Users' && (
          <div className="flex flex-col gap-3">
            {loading && Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="bg-surface-card rounded-2xl p-4 border border-border-subtle flex items-center gap-4">
                <SkeletonCircle size={40} />
                <div className="flex-1 min-w-0">
                  <SkeletonText width="46%" height={14} className="mb-2" />
                  <SkeletonText width="30%" height={11} />
                </div>
                <Skeleton width={92} height={30} radius="9999px" className="shrink-0" />
              </div>
            ))}
            {!loading && users.map(u => (
              <div key={u.id} className="bg-surface-card rounded-2xl p-4 border border-border-subtle flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body-md text-body-md text-on-surface truncate">{u.name}</p>
                  <p className="font-body-xs text-body-xs text-on-surface-variant truncate">{u.email}</p>
                </div>
                <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  className="bg-surface-card border border-border-subtle rounded-lg px-2 py-1 text-on-surface font-body-xs text-body-xs focus:outline-none focus:border-primary">
                  <option value="user">User</option>
                  <option value="artist">Artist</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'All Tracks' && (
          <div className="flex flex-col gap-3">
            {/* `allSongs` comes from the app context rather than this screen's own
                request, so it is only skeletonised while the context's first
                load is still in flight. */}
            {loading && Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="bg-surface-card rounded-2xl p-4 border border-border-subtle flex items-center gap-4">
                <Skeleton width={48} height={48} radius="rounded-xl" className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <SkeletonText width="52%" height={14} className="mb-2" />
                  <SkeletonText width="32%" height={11} />
                </div>
              </div>
            ))}
            {!loading && allSongs.map(song => (
              <div key={song.id} className="bg-surface-card rounded-2xl p-4 border border-border-subtle flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">music_note</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body-md text-body-md text-on-surface truncate">{song.title}</p>
                  <p className="font-body-xs text-body-xs text-on-surface-variant truncate">{song.artist_name} · {formatTime(song.duration)}</p>
                </div>
                <button onClick={() => handleDelete(song.id)} className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center press-feedback">
                  <span className="material-symbols-outlined text-red-400 text-[18px]">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
