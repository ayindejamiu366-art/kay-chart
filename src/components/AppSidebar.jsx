import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { TOUR_KEY_BY_PATH } from './onboarding/onboardingConfig';

export const SIDEBAR_NAV_ITEMS = [
  { icon: 'home', label: 'Home', path: '/home' },
  { icon: 'search', label: 'Search', path: '/search' },
  { icon: 'explore', label: 'Discover', path: '/explore' },
  { icon: 'library_music', label: 'Library', path: '/library' },
  { icon: 'favorite', label: 'Liked Songs', path: '/liked-songs' },
  { icon: 'leaderboard', label: 'Charts', path: '/charts' },
];

export function SidebarBody({ onNavigate }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isArtist, isAdmin } = useApp();

  // Role-gated destinations mirror BottomNav, which is hidden on desktop.
  const navItems = [
    ...SIDEBAR_NAV_ITEMS,
    ...(isArtist ? [{ icon: 'cloud_upload', label: 'Upload', path: '/upload' }] : []),
    ...(isAdmin ? [{ icon: 'admin_panel_settings', label: 'Admin', path: '/admin' }] : []),
  ];

  const go = (path) => {
    navigate(path);
    if (onNavigate) onNavigate();
  };

  return (
    <>
      <div className="px-5 py-5 flex items-center gap-3 shrink-0">
        {/* The Kay Chart mark, as the real SVG asset. */}
        <img
          src="/brand/kay-chart-mark.svg"
          alt=""
          aria-hidden="true"
          width={36}
          height={36}
          className="w-9 h-9 shrink-0 glow-active"
        />
        <span className="font-headline-md text-on-surface tracking-tight">Kay Chart</span>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-3 space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.path || (item.path !== '/home' && pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => go(item.path)}
              aria-current={active ? 'page' : undefined}
              data-tour={TOUR_KEY_BY_PATH[item.path]}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all press-feedback ${
                active ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[21px] ${active ? 'icon-fill' : ''}`}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border-subtle shrink-0">
        <button
          onClick={() => go('/profile')}
          data-tour="profile"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-all press-feedback"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[15px] text-white icon-fill">person</span>
          </div>
          <span className="text-[14px] font-medium truncate">{user?.name || 'Profile'}</span>
        </button>
      </div>
    </>
  );
}

export default function AppSidebar() {
  return (
    <aside className="hidden lg:flex w-[232px] shrink-0 h-screen sticky top-0 flex-col border-r border-border-subtle bg-surface-nav/60">
      <SidebarBody />
    </aside>
  );
}
