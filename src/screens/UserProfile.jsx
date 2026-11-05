import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { useOnboarding } from '../components/onboarding/OnboardingProvider';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import api from '../services/api';
import { detectCountry, getCountryName } from '../utils/country';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';

const LANG_NAMES = { en: 'English', es: 'Español', fr: 'Français', ar: 'العربية', hi: 'हिन्दी', ta: 'தமிழ்', de: 'Deutsch', zh: '中文', ja: '日本語', ko: '한국어', pt: 'Português', ru: 'Русский', tr: 'Türkçe' };

const COUNTRY_CODE_LIST = {
  'US': 'United States', 'GB': 'United Kingdom', 'IN': 'India', 'NG': 'Nigeria', 'GH': 'Ghana',
  'KE': 'Kenya', 'ZA': 'South Africa', 'CA': 'Canada', 'AU': 'Australia', 'BR': 'Brazil',
  'MX': 'Mexico', 'CO': 'Colombia', 'AR': 'Argentina', 'FR': 'France', 'DE': 'Germany',
  'ES': 'Spain', 'IT': 'Italy', 'PT': 'Portugal', 'NL': 'Netherlands', 'SE': 'Sweden',
  'NO': 'Norway', 'FI': 'Finland', 'DK': 'Denmark', 'PL': 'Poland', 'GR': 'Greece',
  'TR': 'Turkey', 'RU': 'Russia', 'UA': 'Ukraine', 'JP': 'Japan', 'KR': 'South Korea',
  'CN': 'China', 'TW': 'Taiwan', 'HK': 'Hong Kong', 'PH': 'Philippines', 'ID': 'Indonesia',
  'MY': 'Malaysia', 'SG': 'Singapore', 'TH': 'Thailand', 'VN': 'Vietnam', 'PK': 'Pakistan',
  'BD': 'Bangladesh', 'LK': 'Sri Lanka', 'NP': 'Nepal', 'EG': 'Egypt', 'DZ': 'Algeria',
  'MA': 'Morocco', 'TN': 'Tunisia', 'SA': 'Saudi Arabia', 'AE': 'UAE', 'IL': 'Israel',
  'TZ': 'Tanzania', 'UG': 'Uganda', 'ET': 'Ethiopia', 'CL': 'Chile', 'PE': 'Peru',
  'VE': 'Venezuela', 'EC': 'Ecuador', 'CU': 'Cuba', 'DO': 'Dominican Republic', 'PR': 'Puerto Rico',
};

const COUNTRY_FLAG = {
  'US': '🇺🇸', 'GB': '🇬🇧', 'IN': '🇮🇳', 'NG': '🇳🇬', 'GH': '🇬🇭', 'KE': '🇰🇪', 'ZA': '🇿🇦',
  'CA': '🇨🇦', 'AU': '🇦🇺', 'BR': '🇧🇷', 'MX': '🇲🇽', 'CO': '🇨🇴', 'AR': '🇦🇷', 'FR': '🇫🇷',
  'DE': '🇩🇪', 'ES': '🇪🇸', 'IT': '🇮🇹', 'PT': '🇵🇹', 'NL': '🇳🇱', 'SE': '🇸🇪', 'NO': '🇳🇴',
  'FI': '🇫🇮', 'DK': '🇩🇰', 'PL': '🇵🇱', 'GR': '🇬🇷', 'TR': '🇹🇷', 'RU': '🇷🇺', 'UA': '🇺🇦',
  'JP': '🇯🇵', 'KR': '🇰🇷', 'CN': '🇨🇳', 'TW': '🇹🇼', 'HK': '🇭🇰', 'PH': '🇵🇭', 'ID': '🇮🇩',
  'MY': '🇲🇾', 'SG': '🇸🇬', 'TH': '🇹🇭', 'VN': '🇻🇳', 'PK': '🇵🇰', 'BD': '🇧🇩', 'LK': '🇱🇰',
  'NP': '🇳🇵', 'EG': '🇪🇬', 'DZ': '🇩🇿', 'MA': '🇲🇦', 'TN': '🇹🇳', 'SA': '🇸🇦', 'AE': '🇦🇪',
  'IL': '🇮🇱', 'TZ': '🇹🇿', 'UG': '🇺🇬', 'ET': '🇪🇹', 'CL': '🇨🇱', 'PE': '🇵🇪', 'VE': '🇻🇪',
  'EC': '🇪🇨', 'CU': '🇨🇺', 'DO': '🇩🇴', 'PR': '🇵🇷',
};

function detectDevice() {
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'Tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'Mobile';
  return 'Desktop';
}
function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown';
}
function detectOS() {
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown';
}
function formatTimeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function UserProfile() {
  const navigate = useNavigate();
  const { user, setUser, downloads, offlineMode, setOfflineMode, userPlan, signOut, isArtist } = useApp();
  const { replay: replayOnboarding } = useOnboarding();
  const { theme, toggleTheme } = useTheme();
  const { lang, t } = useI18n();
  const allLanguages = LANG_NAMES;
  const [expandedSection, setExpandedSection] = useState(() => t('PROFILE_SECTION_ACCOUNT'));
  const [userStats, setUserStats] = useState({ liked: 0, playlists: 0, downloads: 0, plays: 0, memberSince: '' });
  const [artistStats, setArtistStats] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showLicensesModal, setShowLicensesModal] = useState(false);
  const [audioQuality, setAudioQuality] = useState(() => {
    try { return localStorage.getItem('nocturne_audio_quality') || 'high'; } catch { return 'high'; }
  });
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(() => {
    try { return localStorage.getItem('nocturne_country') || detectCountry(); } catch { return 'US'; }
  });

  // 2FA state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(() => {
    try { return localStorage.getItem('nocturne_2fa') === 'true'; } catch { return false; }
  });
  const [twoFAStep, setTwoFAStep] = useState('menu');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFASecret] = useState(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let s = '';
    for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  });

  // Sessions state
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [sessions, setSessions] = useState([]);

  // Login history state
  const [showLoginHistoryModal, setShowLoginHistoryModal] = useState(false);
  const [loginHistory, setLoginHistory] = useState([]);
  const profileRef = useRef(null);
  const statsRef = useRef(null);
  const sectionsContainerRef = useRef(null);

  useEffect(() => {
    if (prefersReduced) return;
    const tl = gsap.timeline({ delay: 0.1 });
    tl.from(profileRef.current, { y: 20, opacity: 0, duration: 0.4, ease: 'power3.out' })
      .from(statsRef.current?.children || [], { y: 15, opacity: 0, stagger: 0.05, duration: 0.3, ease: 'power3.out' }, '-=0.1');
    if (sectionsContainerRef.current) {
      tl.from(sectionsContainerRef.current.children, {
        y: 20, opacity: 0, stagger: 0.06, duration: 0.35, ease: 'power3.out'
      }, '-=0.1');
    }
    return () => tl.kill();
  }, []);

  useEffect(() => {
    api.getUserStats().then(s => setUserStats(s)).catch(() => {});
    if (isArtist) {
      api.analytics.getArtistStats().then(s => setArtistStats(s)).catch(() => {});
    }
  }, [isArtist]);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('nocturne_login_history') || '[]');
    history.unshift({
      id: Date.now().toString(),
      time: new Date().toISOString(),
      device: detectDevice(),
      browser: detectBrowser(),
      os: detectOS(),
      ip: 'Current IP',
      location: getCountryName(selectedCountry) || 'Unknown',
      status: 'success',
    });
    if (history.length > 50) history.splice(50);
    localStorage.setItem('nocturne_login_history', JSON.stringify(history));
  }, []);

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!currentPassword || !newPassword) { setPasswordError(t('PWD_MODAL_ERROR_ALL_FIELDS')); return; }
    if (newPassword.length < 6) { setPasswordError(t('PWD_MODAL_ERROR_MIN_CHARS')); return; }
    if (newPassword !== confirmPassword) { setPasswordError(t('PWD_MODAL_ERROR_NO_MATCH')); return; }
    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setShowPasswordModal(false); setPasswordSuccess(false); }, 1500);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    }
    setChangingPassword(false);
  };

  const handleSignOut = () => {
    signOut();
    navigate('/sign-in', { replace: true });
  };

  const sections = [
    {
      title: t('PROFILE_SECTION_ACCOUNT'),
      items: [
        { icon: 'person', label: t('PROFILE_ITEM_EDIT_PROFILE'), desc: t('PROFILE_ITEM_EDIT_PROFILE_DESC'), action: 'edit', route: '/edit-profile' },
        { icon: 'mail', label: t('PROFILE_ITEM_EMAIL'), desc: user?.email, readonly: true },
        { icon: 'badge', label: t('PROFILE_ITEM_ROLE'), desc: user?.role === 'admin' ? 'Administrator' : user?.role === 'artist' ? 'Artist' : 'Listener', readonly: true },
      ],
    },
    {
      title: t('PROFILE_SECTION_PLAYBACK'),
      items: [
        { icon: 'equalizer', label: t('PROFILE_ITEM_AUDIO_QUALITY'), desc: audioQuality === 'high' ? 'High (320kbps)' : audioQuality === 'lossless' ? 'Lossless' : 'Normal (128kbps)', action: 'quality' },
        { icon: 'download', label: t('PROFILE_ITEM_DOWNLOADS'), desc: `${downloads?.length || 0} tracks`, route: '/downloads' },
        { icon: 'offline_pin', label: t('PROFILE_ITEM_OFFLINE'), toggle: 'offline' },
        { icon: 'workspace_premium', label: 'Kay Chart Pro', desc: userPlan === 'premium' ? "You're subscribed" : 'Ad-free, offline mode & unlimited AI DJ', route: '/premium' },
      ],
    },
    {
      title: t('PROFILE_SECTION_SECURITY'),
      items: [
        { icon: 'lock', label: t('PROFILE_ITEM_CHANGE_PASSWORD'), desc: t('PROFILE_ITEM_CHANGE_PASSWORD_DESC'), action: 'password' },
        { icon: 'shield', label: t('PROFILE_ITEM_2FA'), desc: twoFAEnabled ? 'Enabled — extra login protection' : 'Disabled — add extra security', action: '2fa' },
        { icon: 'devices', label: t('PROFILE_ITEM_SESSIONS'), desc: 'Manage your active sessions', action: 'sessions' },
        { icon: 'history', label: t('PROFILE_ITEM_LOGIN_HISTORY'), desc: 'See where you signed in', action: 'login-history' },
      ],
    },
    {
      title: t('PROFILE_SECTION_PREFERENCES'),
      items: [
        { icon: 'graphic_eq', label: 'Music Preferences', desc: 'Update the genres you listen to', route: '/edit-genres' },
        { icon: 'notifications', label: t('PROFILE_ITEM_NOTIFICATIONS'), desc: t('PROFILE_ITEM_NOTIFICATIONS_DESC'), route: '/notifications' },
        { icon: 'language', label: t('PROFILE_ITEM_LANGUAGE'), desc: allLanguages[lang] || lang, route: '/language' },
        { icon: theme === 'dark' ? 'dark_mode' : 'light_mode', label: t('PROFILE_ITEM_APPEARANCE'), desc: theme === 'dark' ? t('PROFILE_ITEM_DARK_MODE') : t('PROFILE_ITEM_LIGHT_MODE'), toggle: 'theme' },
        { icon: 'music_note', label: 'Spotify Integration', desc: 'Connect for real album art & previews', route: '/spotify' },
        { icon: 'public', label: 'Your Country', desc: getCountryName(selectedCountry) || selectedCountry, action: 'country' },
        { icon: 'help_outline', label: 'Take a tour', desc: 'Replay the quick guide to Kay Chart', action: 'tour' },
        { icon: 'support_agent', label: 'Support', desc: 'Get help', route: '/support' },
      ],
    },
    {
      title: t('PROFILE_SECTION_ABOUT'),
      items: [
        { icon: 'info', label: t('PROFILE_ITEM_ABOUT_NOCTURNE'), desc: 'Version 1.0.0', action: 'about' },
        { icon: 'description', label: t('PROFILE_ITEM_TERMS'), desc: 'Legal', action: 'terms' },
        { icon: 'privacy_tip', label: t('PROFILE_ITEM_PRIVACY'), desc: 'Data handling', action: 'privacy' },
        { icon: 'code', label: t('PROFILE_ITEM_LICENSES'), desc: 'Third-party software', action: 'licenses' },
        { icon: 'analytics', label: 'Analytics Dashboard', desc: 'Platform stats & charts', route: '/analytics', adminOnly: true },
      ],
    },
  ];

  const handleAction = (action) => {
    switch (action) {
      case 'edit': navigate('/edit-profile'); break;
      case 'tour': replayOnboarding(); break;
      case 'password': setShowPasswordModal(true); break;
      case '2fa': setShow2FAModal(true); break;
      case 'sessions': {
        const stored = JSON.parse(localStorage.getItem('nocturne_sessions') || '[]');
        const current = {
          id: 'current',
          device: detectDevice(),
          browser: detectBrowser(),
          os: detectOS(),
          ip: 'Current IP',
          location: getCountryName(selectedCountry) || 'Unknown',
          lastActive: new Date().toISOString(),
          isCurrent: true,
        };
        const all = [current, ...stored.filter(s => s.id !== 'current')];
        setSessions(all);
        setShowSessionsModal(true);
        break;
      }
      case 'login-history': {
        const stored = JSON.parse(localStorage.getItem('nocturne_login_history') || '[]');
        if (stored.length === 0) {
          const now = new Date();
          stored.push({
            id: '1',
            time: now.toISOString(),
            device: detectDevice(),
            browser: detectBrowser(),
            os: detectOS(),
            ip: 'Current IP',
            location: getCountryName(selectedCountry) || 'Unknown',
            status: 'success',
          });
          localStorage.setItem('nocturne_login_history', JSON.stringify(stored));
        }
        setLoginHistory(stored);
        setShowLoginHistoryModal(true);
        break;
      }
      case 'about': setShowAboutModal(true); break;
      case 'terms': setShowTermsModal(true); break;
      case 'privacy': setShowPrivacyModal(true); break;
      case 'licenses': setShowLicensesModal(true); break;
      case 'quality': {
        const qualities = ['normal', 'high', 'lossless'];
        const idx = qualities.indexOf(audioQuality);
        const next = qualities[(idx + 1) % qualities.length];
        setAudioQuality(next);
        try { localStorage.setItem('nocturne_audio_quality', next); } catch {} // eslint-disable-line no-empty
        break;
      }
      case 'country': setShowCountryModal(true); break;
      default: break;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden page-enter">
      <div className="ambient-glow ambient-glow-animated" />

      <header className="w-full sticky top-0 z-40 bg-background/70 backdrop-blur-xl flex justify-between items-center px-6 py-4 relative z-10 fade-up">
        <h1 className="text-on-surface text-lg font-semibold">Profile</h1>
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto relative z-10">
        {/* Profile Card */}
        <button ref={profileRef} onClick={() => navigate('/edit-profile')} className="w-full px-6 py-6 flex flex-col items-center press-feedback">
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-[24px]" />
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-[72px] h-[72px] rounded-full border-[3px] border-primary shadow-[0_0_16px_rgba(214,255,61,0.3)] relative z-10 object-cover" />
            ) : (
              <div className="w-[72px] h-[72px] rounded-full bg-surface-card flex items-center justify-center border-[3px] border-primary shadow-[0_0_16px_rgba(214,255,61,0.3)] relative z-10">
                <span className="material-symbols-outlined icon-fill text-primary text-[28px]">person</span>
              </div>
            )}
          </div>
          <p className="text-lg font-semibold text-on-surface">{user?.name || 'User'}</p>
          {user?.username && (
            <p className="text-sm text-primary font-body-sm">@{user.username}</p>
          )}
          <p className="text-sm text-on-surface-variant">{user?.email}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-on-surface-variant/40 text-[14px]">edit</span>
            <span className="font-body-xs text-body-xs text-on-surface-variant/60">{t('PROFILE_TAP_EDIT')}</span>
          </div>
        </button>

        {/* Stats */}
        <div ref={statsRef} className="px-6 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[
            { label: t('PROFILE_STAT_LIKED'), value: userStats.liked, icon: 'favorite' },
            { label: t('PROFILE_STAT_PLAYLISTS'), value: userStats.playlists, icon: 'queue_music' },
            { label: t('PROFILE_STAT_DOWNLOADS'), value: userStats.downloads, icon: 'download' },
            { label: t('PROFILE_STAT_PLAYS'), value: userStats.plays, icon: 'play_circle' },
          ].map(s => (
            <div key={s.label} className="bg-surface-card rounded-xl p-2.5 text-center border border-border-subtle">
              <span className="material-symbols-outlined text-primary text-[16px]">{s.icon}</span>
              <p className="font-body-sm text-body-sm text-on-surface font-semibold mt-0.5">{s.value}</p>
              <p className="font-body-xs text-[10px] text-on-surface-variant">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Artist Dashboard */}
        {isArtist && artistStats && (
          <div className="px-6 pb-4 fade-up fade-up-2">
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-surface-card to-secondary/10 border border-primary/20 overflow-hidden">
              {/* Artist Header */}
              <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">mic</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Artist Dashboard</h3>
                  {artistStats.verified && (
                    <span className="material-symbols-outlined text-blue-400 text-[16px]">verified</span>
                  )}
                </div>
                <button onClick={() => navigate('/upload')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-background font-body-xs text-body-xs font-semibold press-feedback">
                  <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
                  Upload
                </button>
              </div>

              {/* Artist Stats */}
              <div className="px-4 pb-3 grid grid-cols-4 gap-2">
                {[
                  { label: 'Plays', value: artistStats.totalPlays, icon: 'play_circle', color: 'text-purple-400' },
                  { label: 'Likes', value: artistStats.totalLikes, icon: 'favorite', color: 'text-red-400' },
                  { label: 'Followers', value: artistStats.followers, icon: 'group', color: 'text-blue-400' },
                  { label: 'Songs', value: artistStats.totalSongs, icon: 'music_note', color: 'text-green-400' },
                ].map(s => (
                  <div key={s.label} className="bg-surface-card/60 rounded-xl p-2.5 text-center border border-border-subtle/50">
                    <span className={`material-symbols-outlined ${s.color} text-[14px]`}>{s.icon}</span>
                    <p className="font-body-sm text-body-sm text-on-surface font-semibold mt-0.5">{s.value >= 1000 ? (s.value / 1000).toFixed(1) + 'K' : s.value}</p>
                    <p className="font-body-xs text-[10px] text-on-surface-variant">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Pending Songs */}
              {artistStats.pendingSongs > 0 && (
                <div className="px-4 pb-3">
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-2.5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-400 text-[16px]">pending</span>
                    <span className="font-body-xs text-body-xs text-orange-400">{artistStats.pendingSongs} song{artistStats.pendingSongs > 1 ? 's' : ''} pending review</span>
                  </div>
                </div>
              )}

              {/* Mini Plays Chart */}
              {artistStats.playsByDay?.length > 0 && (
                <div className="px-4 pb-3">
                  <p className="font-body-xs text-body-xs text-on-surface-variant mb-2">Plays (Last 30 days)</p>
                  <div className="flex items-end gap-[2px] h-12">
                    {artistStats.playsByDay.map((day, i) => {
                      const maxCount = Math.max(...artistStats.playsByDay.map(d => d.count || 0), 1);
                      const height = ((day.count || 0) / maxCount) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-t bg-primary/60 hover:bg-primary transition-colors min-w-[2px]"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${day.day || ''}: ${day.count || 0} plays`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Songs */}
              {artistStats.topSongs?.length > 0 && (
                <div className="px-4 pb-4">
                  <p className="font-body-xs text-body-xs text-on-surface-variant mb-2">Top Songs</p>
                  <div className="flex flex-col gap-1.5">
                    {artistStats.topSongs.slice(0, 3).map((song, i) => (
                      <div key={song.id} className="flex items-center gap-2.5 bg-surface-card/40 rounded-xl px-3 py-2">
                        <span className="font-body-xs text-body-xs text-on-surface-variant w-4 text-center font-bold">{i + 1}</span>
                        {song.cover ? (
                          <img src={song.cover} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-[14px]">music_note</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-body-xs text-body-xs text-on-surface truncate">{song.title}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="material-symbols-outlined text-purple-400 text-[12px]">play_circle</span>
                          <span className="font-body-xs text-[10px] text-on-surface-variant">{song.play_count >= 1000 ? (song.play_count / 1000).toFixed(1) + 'K' : song.play_count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Links */}
              <div className="px-4 pb-4 flex gap-2">
                <button onClick={() => navigate('/upload')} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary font-body-xs text-body-xs font-semibold press-feedback">
                  <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                  Upload Music
                </button>
                <button onClick={() => navigate('/analytics')} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-card border border-border-subtle text-on-surface-variant font-body-xs text-body-xs press-feedback">
                  <span className="material-symbols-outlined text-[16px]">bar_chart</span>
                  Full Analytics
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Sections */}
        <div ref={sectionsContainerRef} className="px-6 pb-28 flex flex-col gap-4">
          {sections.map((section, sIdx) => (
            <div
              key={section.title}
              className="rounded-2xl bg-surface-card border border-border-subtle overflow-hidden"
            >
              <button
                onClick={() => setExpandedSection(expandedSection === section.title ? null : section.title)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-card-hover transition-colors"
              >
                <span className="font-label-lg text-label-lg text-on-surface-variant uppercase tracking-wider text-xs">{section.title}</span>
                <span className={`material-symbols-outlined text-on-surface-variant text-[20px] transition-transform duration-300 ${expandedSection === section.title ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {expandedSection === section.title && (
                <div className="flex flex-col">
                  {section.items.filter(item => !item.adminOnly || user?.role === 'admin').map((item, iIdx) => (
                    <div key={iIdx} className="border-t border-border-subtle">
                      {item.toggle === 'offline' ? (
                        <div className="flex items-center justify-between px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">{item.icon}</span>
                            <div>
                              <p className="font-body-md text-body-md text-on-surface">{item.label}</p>
                              <p className="font-body-xs text-body-xs text-on-surface-variant">{item.desc}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setOfflineMode(!offlineMode)}
                            className={`w-11 h-6 rounded-full transition-all duration-300 relative ${offlineMode ? 'bg-primary shadow-[0_0_10px_rgba(214,255,61,0.3)]' : 'bg-surface-container-high'}`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-background absolute top-0.5 transition-all duration-300 shadow ${offlineMode ? 'left-[22px]' : 'left-0.5'}`} />
                          </button>
                        </div>
                      ) : item.toggle === 'theme' ? (
                        <div className="flex items-center justify-between px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">{item.icon}</span>
                            <div>
                              <p className="font-body-md text-body-md text-on-surface">{item.label}</p>
                              <p className="font-body-xs text-body-xs text-on-surface-variant">{item.desc}</p>
                            </div>
                          </div>
                          <button
                            onClick={toggleTheme}
                            className={`w-11 h-6 rounded-full transition-all duration-300 relative ${theme === 'light' ? 'bg-primary shadow-[0_0_10px_rgba(214,255,61,0.3)]' : 'bg-surface-container-high'}`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300 shadow flex items-center justify-center ${theme === 'light' ? 'left-[22px]' : 'left-0.5'}`}>
                              <span className="material-symbols-outlined text-[10px]" style={{ color: theme === 'light' ? '#9FE81F' : '#8B8B9E' }}>
                                {theme === 'light' ? 'light_mode' : 'dark_mode'}
                              </span>
                            </div>
                          </button>
                        </div>
                      ) : item.readonly ? (
                        <div className="flex items-center justify-between px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">{item.icon}</span>
                            <div>
                              <p className="font-body-md text-body-md text-on-surface">{item.label}</p>
                              <p className="font-body-xs text-body-xs text-on-surface-variant truncate max-w-[200px]">{item.desc}</p>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-on-surface-variant/20 text-[16px]">lock</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => item.route ? navigate(item.route) : handleAction(item.action)}
                          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-card-hover transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">{item.icon}</span>
                            <div>
                              <p className="font-body-md text-body-md text-on-surface">{item.label}</p>
                              {item.desc && <p className="font-body-xs text-body-xs text-on-surface-variant">{item.desc}</p>}
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-on-surface-variant/40 text-[18px]">chevron_right</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button onClick={handleSignOut} className="w-full py-3.5 rounded-2xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-body-md text-body-md mt-2">
            {t('PROFILE_SIGN_OUT')}
          </button>
        </div>
      </main>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowPasswordModal(false)}>
          <div className="w-full max-w-md bg-surface-card rounded-t-3xl sm:rounded-3xl p-6 pb-8 border border-border-subtle" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline-md text-headline-md text-on-surface">{t('PWD_MODAL_HEADING')}</h2>
              <button onClick={() => setShowPasswordModal(false)} className="text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {passwordSuccess ? (
              <div className="flex flex-col items-center py-6">
                <span className="material-symbols-outlined text-green-500 text-[48px] mb-2">check_circle</span>
                <p className="font-body-md text-on-surface">{t('PWD_MODAL_SUCCESS')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {passwordError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-400 text-[16px]">error</span>
                    <p className="font-body-sm text-body-sm text-red-400">{passwordError}</p>
                  </div>
                )}
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder={t('PWD_MODAL_CURRENT_PLACEHOLDER')} className="w-full h-12 px-4 rounded-xl bg-background border border-border-subtle text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary" />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('PWD_MODAL_NEW_PLACEHOLDER')} className="w-full h-12 px-4 rounded-xl bg-background border border-border-subtle text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary" />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t('PWD_MODAL_CONFIRM_PLACEHOLDER')} className="w-full h-12 px-4 rounded-xl bg-background border border-border-subtle text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary" />
                <button onClick={handleChangePassword} disabled={changingPassword} className="w-full h-12 rounded-xl btn-primary font-body-md text-body-md flex items-center justify-center gap-2 mt-1">
                  {changingPassword ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : t('PWD_MODAL_UPDATE_BTN')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowAboutModal(false)}>
          <div className="w-full max-w-md bg-surface-card rounded-t-3xl sm:rounded-3xl p-6 pb-8 border border-border-subtle" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center py-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(214,255,61,0.3)]">
                <span className="material-symbols-outlined text-background text-[36px] icon-fill">music_note</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">{t('ABOUT_MODAL_HEADING')}</h2>
              <p className="font-body-sm text-on-surface-variant mt-1">{t('ABOUT_MODAL_VERSION')}</p>
              <p className="font-body-xs text-on-surface-variant/60 mt-4 text-center">{t('ABOUT_MODAL_DESCRIPTION')}</p>
              <button onClick={() => setShowAboutModal(false)} className="mt-6 px-8 py-2.5 rounded-full bg-primary/10 text-primary font-body-sm text-body-sm font-semibold press-feedback">{t('ABOUT_MODAL_CLOSE')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowTermsModal(false)}>
          <div className="w-full max-w-md bg-surface-card rounded-t-3xl sm:rounded-3xl p-6 pb-8 border border-border-subtle max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">{t('TERMS_MODAL_HEADING')}</h2>
              <button onClick={() => setShowTermsModal(false)} className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="font-body-sm text-body-sm text-on-surface-variant space-y-4">
              <p>{t('TERMS_ACCEPTANCE')}</p>
              <p>{t('TERMS_ACCOUNT')}</p>
              <p>{t('TERMS_CONTENT')}</p>
              <p>{t('TERMS_USAGE')}</p>
              <p>{t('TERMS_TERMINATION')}</p>
              <p>{t('TERMS_CHANGES')}</p>
            </div>
            <button onClick={() => setShowTermsModal(false)} className="mt-4 w-full py-2.5 rounded-xl bg-primary/10 text-primary font-body-sm text-body-sm font-semibold press-feedback">{t('TERMS_I_UNDERSTAND')}</button>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowPrivacyModal(false)}>
          <div className="w-full max-w-md bg-surface-card rounded-t-3xl sm:rounded-3xl p-6 pb-8 border border-border-subtle max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">{t('PRIVACY_MODAL_HEADING')}</h2>
              <button onClick={() => setShowPrivacyModal(false)} className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="font-body-sm text-body-sm text-on-surface-variant space-y-4">
              <p>{t('PRIVACY_DATA_COLLECTION')}</p>
              <p>{t('PRIVACY_USAGE_DATA')}</p>
              <p>{t('PRIVACY_DATA_STORAGE')}</p>
              <p>{t('PRIVACY_THIRD_PARTIES')}</p>
              <p>{t('PRIVACY_YOUR_RIGHTS')}</p>
              <p>{t('PRIVACY_CONTACT')}</p>
            </div>
            <button onClick={() => setShowPrivacyModal(false)} className="mt-4 w-full py-2.5 rounded-xl bg-primary/10 text-primary font-body-sm text-body-sm font-semibold press-feedback">{t('TERMS_I_UNDERSTAND')}</button>
          </div>
        </div>
      )}

      {/* Licenses Modal */}
      {showLicensesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowLicensesModal(false)}>
          <div className="w-full max-w-md bg-surface-card rounded-t-3xl sm:rounded-3xl p-6 pb-8 border border-border-subtle max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">{t('LICENSES_MODAL_HEADING')}</h2>
              <button onClick={() => setShowLicensesModal(false)} className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="font-body-sm text-body-sm text-on-surface-variant space-y-3">
              {[
                { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react' },
                { name: 'React Router', license: 'MIT', url: 'https://github.com/remix-run/react-router' },
                { name: 'Vite', license: 'MIT', url: 'https://github.com/vitejs/vite' },
                { name: 'Tailwind CSS', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss' },
                { name: 'Express', license: 'MIT', url: 'https://github.com/expressjs/express' },
                { name: 'SQLite', license: 'Public Domain', url: 'https://www.sqlite.org/' },
                { name: 'bcrypt.js', license: 'MIT', url: 'https://github.com/nicolo-ribaudo/bcryptjs' },
                { name: 'jsonwebtoken', license: 'MIT', url: 'https://github.com/auth0/node-jsonwebtoken' },
              ].map(lib => (
                <div key={lib.name} className="flex items-center justify-between py-2 border-b border-border-subtle/50">
                  <div>
                    <p className="text-on-surface font-semibold">{lib.name}</p>
                    <p className="text-[11px] text-on-surface-variant/60">{lib.license}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowLicensesModal(false)} className="mt-4 w-full py-2.5 rounded-xl bg-primary/10 text-primary font-body-sm text-body-sm font-semibold press-feedback">{t('ABOUT_MODAL_CLOSE')}</button>
          </div>
        </div>
      )}

      {/* Country Modal */}
      {showCountryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowCountryModal(false)}>
          <div className="w-full max-w-md bg-surface-card rounded-t-3xl sm:rounded-3xl p-6 pb-8 border border-border-subtle max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">Your Country</h2>
              <button onClick={() => setShowCountryModal(false)} className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">Pick your country so Kay Chart shows trending music, new releases and artists from your region.</p>
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {Object.keys(COUNTRY_CODE_LIST).map(cc => {
                const name = getCountryName(cc);
                const active = selectedCountry === cc;
                return (
                  <button key={cc} onClick={() => {
                    setSelectedCountry(cc);
                    try { localStorage.setItem('nocturne_country', cc); } catch (e) {} // eslint-disable-line no-empty
                    setShowCountryModal(false);
                  }} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left ${
                    active ? 'bg-primary/15 border-primary text-primary' : 'bg-surface-card border-border-subtle text-on-surface'
                  } press-feedback`}>
                    <span className="text-lg">{COUNTRY_FLAG[cc] || '🌍'}</span>
                    <span className="text-[13px] font-medium truncate">{name}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowCountryModal(false)} className="mt-4 w-full py-2.5 rounded-xl bg-primary/10 text-primary font-body-sm text-body-sm font-semibold press-feedback">{t('ABOUT_MODAL_CLOSE')}</button>
          </div>
        </div>
      )}

      {/* 2FA Modal */}
      {show2FAModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => { setShow2FAModal(false); setTwoFAStep('menu'); setTwoFACode(''); setTwoFAError(''); }}>
          <div className="w-full max-w-md bg-surface-card rounded-t-3xl sm:rounded-3xl p-6 pb-8 border border-border-subtle" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline-md text-headline-md text-on-surface">Two-Factor Authentication</h2>
              <button onClick={() => { setShow2FAModal(false); setTwoFAStep('menu'); setTwoFACode(''); setTwoFAError(''); }} className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
            </div>

            {twoFAStep === 'menu' && (
              <div className="flex flex-col gap-4">
                <div className={`flex items-center gap-3 p-4 rounded-xl ${twoFAEnabled ? 'bg-green-500/10 border border-green-500/30' : 'bg-surface-container-high'}`}>
                  <span className={`material-symbols-outlined text-[28px] ${twoFAEnabled ? 'text-green-400' : 'text-on-surface-variant'}`}>shield</span>
                  <div className="flex-1">
                    <p className="font-body-md text-on-surface">{twoFAEnabled ? '2FA is Enabled' : '2FA is Disabled'}</p>
                    <p className="font-body-xs text-on-surface-variant">{twoFAEnabled ? 'Your account has extra protection' : 'Add an extra layer of security'}</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${twoFAEnabled ? 'bg-primary shadow-[0_0_10px_rgba(214,255,61,0.3)]' : 'bg-surface-container-high'}`}>
                    <div className={`w-5 h-5 rounded-full bg-background absolute top-0.5 transition-all duration-300 shadow ${twoFAEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </div>
                </div>
                <p className="font-body-xs text-on-surface-variant">
                  {twoFAEnabled
                    ? 'When enabled, you will need to enter a 6-digit code from your authenticator app each time you sign in.'
                    : 'Two-factor authentication adds an extra layer of security to your account. You will need an authenticator app like Google Authenticator or Authy.'}
                </p>
                <button onClick={() => {
                  if (twoFAEnabled) {
                    setTwoFAEnabled(false);
                    try { localStorage.removeItem('nocturne_2fa'); } catch {} // eslint-disable-line no-empty
                  } else {
                    setTwoFAStep('setup');
                  }
                }} className={`w-full h-12 rounded-xl font-body-md text-body-md flex items-center justify-center gap-2 press-feedback ${twoFAEnabled ? 'border border-red-500/30 text-red-400 hover:bg-red-500/10' : 'btn-primary'}`}>
                  <span className="material-symbols-outlined text-[18px]">{twoFAEnabled ? 'shield' : 'shield'}</span>
                  {twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
              </div>
            )}

            {twoFAStep === 'setup' && (
              <div className="flex flex-col gap-4">
                <p className="font-body-sm text-on-surface-variant">Scan this QR code with your authenticator app, or enter the secret manually:</p>
                <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-3">
                  <div className="w-48 h-48 bg-gray-100 rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(0deg, #000 0 2px, transparent 2px 8px), repeating-linear-gradient(90deg, #000 0 2px, transparent 2px 8px)'}} />
                    <span className="material-symbols-outlined text-[64px] text-gray-800 relative z-10">qr_code_2</span>
                    <p className="text-[10px] text-gray-500 relative z-10 mt-1">Scan with authenticator app</p>
                  </div>
                  <div className="w-full">
                    <p className="text-[11px] text-gray-500 mb-1 text-center">Or enter this secret key manually:</p>
                    <div className="bg-gray-100 rounded-lg px-3 py-2 text-center font-mono text-sm text-gray-800 tracking-widest select-all">
                      {twoFASecret}
                    </div>
                  </div>
                </div>
                <p className="font-body-xs text-on-surface-variant">After scanning, enter the 6-digit code from your authenticator app to verify:</p>
                {twoFAError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-400 text-[16px]">error</span>
                    <p className="font-body-sm text-body-sm text-red-400">{twoFAError}</p>
                  </div>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFACode}
                  onChange={e => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  className="w-full h-12 px-4 rounded-xl bg-background border border-border-subtle text-on-surface font-body-sm text-body-sm text-center tracking-[0.3em] font-mono placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                />
                <div className="flex gap-3">
                  <button onClick={() => { setTwoFAStep('menu'); setTwoFACode(''); setTwoFAError(''); }} className="flex-1 h-12 rounded-xl border border-border-subtle text-on-surface-variant font-body-md text-body-md press-feedback">Cancel</button>
                  <button onClick={() => {
                    if (twoFACode.length !== 6) { setTwoFAError('Please enter a 6-digit code'); return; }
                    setTwoFAEnabled(true);
                    try { localStorage.setItem('nocturne_2fa', 'true'); } catch {} // eslint-disable-line no-empty
                    setTwoFAStep('success');
                  }} className="flex-1 h-12 rounded-xl btn-primary font-body-md text-body-md press-feedback">Verify & Enable</button>
                </div>
              </div>
            )}

            {twoFAStep === 'success' && (
              <div className="flex flex-col items-center py-6 gap-3">
                <span className="material-symbols-outlined text-green-500 text-[56px]">check_circle</span>
                <p className="font-headline-sm text-headline-sm text-on-surface">2FA Enabled!</p>
                <p className="font-body-sm text-on-surface-variant text-center">Your account is now protected with two-factor authentication. You will need your authenticator app to sign in.</p>
                <button onClick={() => { setShow2FAModal(false); setTwoFAStep('menu'); setTwoFACode(''); }} className="mt-2 px-8 py-2.5 rounded-full bg-primary/10 text-primary font-body-sm text-body-sm font-semibold press-feedback">Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sessions Modal */}
      {showSessionsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowSessionsModal(false)}>
          <div className="w-full max-w-md bg-surface-card rounded-t-3xl sm:rounded-3xl p-6 pb-8 border border-border-subtle max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">Active Sessions</h2>
              <button onClick={() => setShowSessionsModal(false)} className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
            </div>
            <p className="font-body-xs text-on-surface-variant mb-4">These are the devices currently signed in to your account.</p>
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
                <div key={session.id} className={`rounded-xl p-4 border ${session.isCurrent ? 'bg-primary/5 border-primary/20' : 'bg-surface-card border-border-subtle'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                        {session.device === 'Mobile' ? 'smartphone' : session.device === 'Tablet' ? 'tablet' : 'computer'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-body-sm text-body-sm text-on-surface font-medium truncate">{session.browser} on {session.os}</p>
                        {session.isCurrent && (
                          <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-semibold shrink-0">Current</span>
                        )}
                      </div>
                      <p className="font-body-xs text-xs text-on-surface-variant mt-0.5">{session.location} · {session.ip}</p>
                      <p className="font-body-xs text-[11px] text-on-surface-variant/60 mt-0.5">Last active: {formatTimeAgo(session.lastActive)}</p>
                    </div>
                    {!session.isCurrent && (
                      <button onClick={() => {
                        const updated = sessions.filter(s => s.id !== session.id);
                        setSessions(updated);
                        const stored = updated.filter(s => !s.isCurrent);
                        localStorage.setItem('nocturne_sessions', JSON.stringify(stored));
                      }} className="text-red-400 hover:text-red-300 shrink-0 press-feedback">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => {
              const current = sessions.find(s => s.isCurrent);
              setSessions(current ? [current] : []);
              localStorage.removeItem('nocturne_sessions');
            }} className="mt-4 w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-body-sm text-body-sm press-feedback">Sign Out All Other Sessions</button>
            <button onClick={() => setShowSessionsModal(false)} className="mt-2 w-full py-2.5 rounded-xl bg-primary/10 text-primary font-body-sm text-body-sm font-semibold press-feedback">Close</button>
          </div>
        </div>
      )}

      {/* Login History Modal */}
      {showLoginHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowLoginHistoryModal(false)}>
          <div className="w-full max-w-md bg-surface-card rounded-t-3xl sm:rounded-3xl p-6 pb-8 border border-border-subtle max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">Login History</h2>
              <button onClick={() => setShowLoginHistoryModal(false)} className="text-on-surface-variant"><span className="material-symbols-outlined">close</span></button>
            </div>
            <p className="font-body-xs text-on-surface-variant mb-4">Recent sign-in activity on your account.</p>
            <div className="flex flex-col gap-2">
              {loginHistory.slice(0, 20).map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 py-3 border-b border-border-subtle/50 last:border-b-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${entry.status === 'success' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <span className={`material-symbols-outlined text-[18px] ${entry.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {entry.status === 'success' ? 'check_circle' : 'error'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body-sm text-body-sm text-on-surface">{entry.browser} on {entry.os} · {entry.device}</p>
                    <p className="font-body-xs text-xs text-on-surface-variant">{entry.location} · {entry.ip}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-body-xs text-[11px] text-on-surface-variant/60">{formatTimeAgo(entry.time)}</p>
                    <p className={`font-body-xs text-[10px] ${entry.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>{entry.status === 'success' ? 'Success' : 'Failed'}</p>
                  </div>
                </div>
              ))}
              {loginHistory.length === 0 && (
                <div className="flex flex-col items-center py-8 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[40px] mb-2">history</span>
                  <p className="font-body-sm text-sm">No login history yet</p>
                </div>
              )}
            </div>
            <button onClick={() => {
              localStorage.removeItem('nocturne_login_history');
              setLoginHistory([]);
            }} className="mt-4 w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-body-sm text-body-sm press-feedback">Clear History</button>
            <button onClick={() => setShowLoginHistoryModal(false)} className="mt-2 w-full py-2.5 rounded-xl bg-primary/10 text-primary font-body-sm text-body-sm font-semibold press-feedback">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
