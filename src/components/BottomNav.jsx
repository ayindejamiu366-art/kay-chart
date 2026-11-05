import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReduced } from '../utils/gsap';
import { TOUR_KEY_BY_PATH } from './onboarding/onboardingConfig';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isArtist } = useApp();
  const itemRefs = useRef({});
  const indicatorRef = useRef(null);
  const prevLabelRef = useRef(null);
  const [ready, setReady] = useState(false);

  const NAV_ITEMS = [
    { icon: 'home', label: 'Home', path: '/home' },
    { icon: 'search', label: 'Search', path: '/search' },
    { icon: 'explore', label: 'Discover', path: '/explore' },
    { icon: 'leaderboard', label: 'Charts', path: '/charts' },
    ...(isArtist ? [{ icon: 'cloud_upload', label: 'Upload', path: '/upload' }] : []),
    ...(isAdmin ? [{ icon: 'admin_panel_settings', label: 'Admin', path: '/admin' }] : []),
    { icon: 'repeat', label: 'Library', path: '/library' },
    { icon: 'person', label: 'Profile', path: '/profile' },
  ];

  const isActive = (path) => location.pathname.startsWith(path);
  const activeItem = NAV_ITEMS.find(i => isActive(i.path));

  useLayoutEffect(() => {
    const el = activeItem && itemRefs.current[activeItem.label];
    if (el && indicatorRef.current) {
      gsap.to(indicatorRef.current, {
        left: el.offsetLeft,
        width: el.offsetWidth,
        duration: 0.45,
        ease: 'elastic.out(1, 0.75)',
      });
    }
  }, [activeItem?.label, NAV_ITEMS.length]);

  useEffect(() => {
    setReady(true);
  }, []);

  // Icon pop animation when active tab changes
  useGSAP(() => {
    if (!activeItem?.label) return;
    const el = itemRefs.current[activeItem.label];
    const icon = el?.querySelector('.nav-icon');
    if (!icon || prefersReduced) return;
    if (prevLabelRef.current === activeItem.label) return;
    prevLabelRef.current = activeItem.label;
    gsap.fromTo(icon,
      { scale: 0.5, rotation: -15 },
      { scale: 1, rotation: 0, duration: 0.4, ease: 'back.out(2)' }
    );
  }, { dependencies: [activeItem?.label] });

  return (
    <nav className="lg:hidden fixed bottom-3 left-3 right-3 h-[68px] flex justify-around items-center px-2 bg-surface-nav/90 backdrop-blur-xl border border-border-subtle z-50 rounded-full shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
      {ready && (
        <div
          ref={indicatorRef}
          className="absolute top-1/2 h-12 rounded-full bg-primary shadow-[0_0_16px_rgba(214,255,61,0.35)] glow-pulse pointer-events-none"
          style={{
            left: activeItem ? itemRefs.current[activeItem.label]?.offsetLeft || 0 : 0,
            width: activeItem ? itemRefs.current[activeItem.label]?.offsetWidth || 48 : 48,
            transform: 'translateY(-50%)',
          }}
        />
      )}
      {NAV_ITEMS.map(({ icon, label, path }) => {
        const active = isActive(path);
        return (
          <button
            key={label}
            ref={(el) => { itemRefs.current[label] = el; }}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            data-tour={TOUR_KEY_BY_PATH[path]}
            onClick={() => navigate(path)}
            className={`relative z-10 flex-1 max-w-12 min-w-0 h-12 flex items-center justify-center rounded-full press-feedback transition-colors duration-300 ${
              active ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
            }`}
          >
            <span
              className={`nav-icon material-symbols-outlined text-[22px] ${active ? 'icon-fill' : ''}`}
            >
              {icon}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
