import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import api from '../services/api';
import { SkeletonText, SkeletonTrackList } from '../components/skeleton';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function getActionText(action) {
  switch (action) {
    case 'like': return 'liked a song';
    case 'play': return 'is listening to';
    case 'follow': return 'started following';
    case 'add_to_playlist': return 'added to playlist';
    case 'upload': return 'uploaded a new track';
    default: return action;
  }
}

function UserAvatar({ user, size = 'w-10 h-10' }) {
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className={`${size} rounded-full object-cover shrink-0`}
      />
    );
  }
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  return (
    <div className={`${size} rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 font-semibold text-sm`}>
      {initials}
    </div>
  );
}

export default function ActivityFeed() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [feed, setFeed] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [followingMap, setFollowingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [feedRes, sugRes] = await Promise.all([
        api.social.getFeed(),
        api.social.getSuggestions(),
      ]);
      setFeed(feedRes.items || feedRes.feed || []);
      setSuggestions(sugRes.users || sugRes.suggestions || []);
    } catch (err) {
      console.error('Failed to load activity feed:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await fetchData();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const toggleFollow = async (userId) => {
    try {
      const res = await api.social.follow(userId);
      setFollowingMap(prev => ({ ...prev, [userId]: res.following }));
    } catch (err) {
      console.error('Follow failed:', err);
    }
  };

  const handleItemPress = (item) => {
    if (!item?.target) return;
    const { targetType, targetId } = item.target;
    if (targetType === 'song') navigate(`/song/${targetId}`);
    else if (targetType === 'playlist') navigate(`/playlist/${targetId}`);
    else if (targetType === 'album') navigate(`/album/${targetId}`);
    else if (targetType === 'user') navigate(`/profile/${targetId}`);
  };

  const handleUserPress = (user) => {
    if (user?.id) navigate(`/profile/${user.id}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden">
      <div className="ambient-glow ambient-glow-animated" />

      <header className="w-full sticky top-0 z-40 bg-background/70 backdrop-blur-xl flex justify-between items-center px-6 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-on-surface-variant hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-on-surface text-lg font-semibold">{t('ACTIVITY_HEADING') || 'Activity'}</h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[22px] ${refreshing ? 'animate-spin' : ''}`}>
            refresh
          </span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto relative z-10">
        {/* Skeleton replaces the spinner for the first load. A pull-to-refresh
            (`refreshing`) deliberately does NOT reach this branch: `loading` is
            only set on mount, so existing rows stay visible during a refresh and
            the header's own spinner indicates progress. */}
        {loading ? (
          <div className="px-6 pt-2">
            <SkeletonText width={168} height={16} className="mb-3" />
            <SkeletonTrackList rows={6} artworkSize={40} />
          </div>
        ) : feed.length === 0 && suggestions.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <span className="material-symbols-outlined text-on-surface-variant/40 text-[64px] mb-4">
              explore
            </span>
            <p className="text-lg font-semibold text-on-surface mb-2">
              {t('ACTIVITY_EMPTY_HEADING') || 'No activity yet'}
            </p>
            <p className="text-sm text-on-surface-variant">
              {t('ACTIVITY_EMPTY_DESC') || 'Follow people to see what they\'re listening to'}
            </p>
          </div>
        ) : (
          <>
            {suggestions.length > 0 && (
              <div className="mb-6">
                <h2 className="text-on-surface font-semibold px-6 mb-3">
                  {t('ACTIVITY_SUGGESTED') || 'Suggested for you'}
                </h2>
                <div className="flex gap-3 overflow-x-auto px-6 pb-2 hide-scrollbar">
                  {suggestions.map(user => (
                    <div
                      key={user.id}
                      className="flex flex-col items-center gap-2 min-w-[120px] bg-surface-card rounded-xl p-4 border border-border-subtle shrink-0"
                    >
                      <button onClick={() => handleUserPress(user)}>
                        <UserAvatar user={user} size="w-14 h-14" />
                      </button>
                      <button
                        onClick={() => handleUserPress(user)}
                        className="text-sm font-semibold text-on-surface truncate max-w-full"
                      >
                        {user.name}
                      </button>
                      <button
                        onClick={() => toggleFollow(user.id)}
                        className={`text-xs font-semibold px-4 py-1.5 rounded-full transition-all ${
                          followingMap[user.id]
                            ? 'bg-surface-card text-on-surface-variant border border-border-subtle'
                            : 'bg-primary text-background'
                        }`}
                      >
                        {followingMap[user.id] ? (t('UNFOLLOW') || 'Following') : (t('FOLLOW') || 'Follow')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="px-6 flex flex-col gap-3">
              {feed.map((item, index) => (
                <div
                  key={item.id || index}
                  className="bg-surface-card rounded-xl p-4 border border-border-subtle"
                >
                  <div className="flex items-start gap-3">
                    <button onClick={() => handleUserPress(item.user)} className="shrink-0">
                      <UserAvatar user={item.user} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-on-surface">
                        <button
                          onClick={() => handleUserPress(item.user)}
                          className="font-semibold hover:underline"
                        >
                          {item.user?.name || 'Unknown'}
                        </button>{' '}
                        <span className="text-on-surface-variant">
                          {getActionText(item.action)}
                        </span>
                      </p>
                      <p className="text-xs text-on-surface-variant/60 mt-1">
                        {timeAgo(item.createdAt || item.timestamp)}
                      </p>
                    </div>

                    {item.target && (
                      <button
                        onClick={() => handleItemPress(item)}
                        className="flex items-center gap-2 bg-background/50 rounded-lg p-2 shrink-0 max-w-[200px] hover:bg-background/80 transition-colors"
                      >
                        {item.target.thumbnail ? (
                          <img
                            src={item.target.thumbnail}
                            alt={item.target.name}
                            className="w-10 h-10 rounded-md object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-surface-card flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-on-surface-variant/50 text-[18px]">
                              {item.target.targetType === 'song' ? 'music_note'
                                : item.target.targetType === 'playlist' ? 'playlist_music'
                                : item.target.targetType === 'album' ? 'album'
                                : item.target.targetType === 'user' ? 'person' : 'link'}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-on-surface truncate">
                            {item.target.name}
                          </p>
                          {item.target.artist && (
                            <p className="text-[11px] text-on-surface-variant/60 truncate">
                              {item.target.artist}
                            </p>
                          )}
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
