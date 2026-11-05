import { gsap } from 'gsap';

// Respect prefers-reduced-motion
const prefersReduced = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Default gsap config for the project
gsap.defaults({
  ease: 'power3.out',
  duration: 0.5,
});

// ── Reusable animation presets ──────────────────────────────────────

export const fadeUp = (el, opts = {}) => {
  if (prefersReduced) return gsap.set(el, { opacity: 1 });
  return gsap.fromTo(el,
    { opacity: 0, y: opts.y ?? 20, scale: opts.scale ?? 1 },
    { opacity: 1, y: 0, scale: 1, duration: opts.duration ?? 0.5, delay: opts.delay ?? 0, ease: opts.ease ?? 'power3.out', ...opts }
  );
};

export const fadeIn = (el, opts = {}) => {
  if (prefersReduced) return gsap.set(el, { opacity: 1 });
  return gsap.fromTo(el,
    { opacity: 0 },
    { opacity: 1, duration: opts.duration ?? 0.4, delay: opts.delay ?? 0, ...opts }
  );
};

export const scaleIn = (el, opts = {}) => {
  if (prefersReduced) return gsap.set(el, { opacity: 1, scale: 1 });
  return gsap.fromTo(el,
    { opacity: 0, scale: opts.from ?? 0.85 },
    { opacity: 1, scale: 1, duration: opts.duration ?? 0.5, delay: opts.delay ?? 0, ease: opts.ease ?? 'back.out(1.7)', ...opts }
  );
};

export const slideIn = (el, opts = {}) => {
  if (prefersReduced) return gsap.set(el, { opacity: 1 });
  const dir = opts.direction ?? 'up';
  const dist = opts.distance ?? 40;
  const from = { opacity: 0 };
  if (dir === 'up') from.y = dist;
  else if (dir === 'down') from.y = -dist;
  else if (dir === 'left') from.x = dist;
  else if (dir === 'right') from.x = -dist;
  return gsap.fromTo(el, from,
    { opacity: 1, x: 0, y: 0, duration: opts.duration ?? 0.5, delay: opts.delay ?? 0, ease: opts.ease ?? 'power3.out', ...opts }
  );
};

export const staggerFadeUp = (elements, opts = {}) => {
  if (prefersReduced) return gsap.set(elements, { opacity: 1 });
  return gsap.fromTo(elements,
    { opacity: 0, y: opts.y ?? 24 },
    { opacity: 1, y: 0, duration: opts.duration ?? 0.45, stagger: opts.stagger ?? 0.06, ease: opts.ease ?? 'power3.out', ...opts }
  );
};

// ── Micro-interactions ──────────────────────────────────────────────

export const popIn = (el, opts = {}) => {
  if (prefersReduced) return gsap.set(el, { opacity: 1, scale: 1 });
  return gsap.fromTo(el,
    { scale: 0, opacity: 0 },
    { scale: 1, opacity: 1, duration: opts.duration ?? 0.4, ease: 'back.out(2)', ...opts }
  );
};

export const pulse = (el, opts = {}) => {
  if (prefersReduced) return;
  return gsap.to(el,
    { scale: opts.scale ?? 1.08, duration: opts.duration ?? 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut', ...opts }
  );
};

export const heartBeat = (el) => {
  if (prefersReduced) return;
  const tl = gsap.timeline();
  tl.to(el, { scale: 1.3, duration: 0.15, ease: 'power2.out' })
    .to(el, { scale: 1, duration: 0.15, ease: 'power2.in' })
    .to(el, { scale: 1.15, duration: 0.1, ease: 'power2.out' })
    .to(el, { scale: 1, duration: 0.1, ease: 'power2.in' });
  return tl;
};

// ── Page transition presets ─────────────────────────────────────────

export const pageEnter = (el) => {
  if (prefersReduced) return gsap.set(el, { opacity: 1 });
  return gsap.fromTo(el,
    { opacity: 0, y: 16, scale: 0.98 },
    { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' }
  );
};

export const pageExit = (el) => {
  if (prefersReduced) return Promise.resolve();
  return gsap.to(el,
    { opacity: 0, y: -10, duration: 0.2, ease: 'power2.in' }
  );
};

// ── Modal / bottom-sheet presets ────────────────────────────────────

export const modalEnter = (overlay, panel) => {
  const tl = gsap.timeline();
  if (prefersReduced) {
    gsap.set(overlay, { opacity: 1 });
    gsap.set(panel, { opacity: 1, y: 0 });
    return tl;
  }
  tl.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.25 })
    .fromTo(panel, { opacity: 0, y: 60, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power3.out' }, '-=0.15');
  return tl;
};

export const modalExit = (overlay, panel) => {
  const tl = gsap.timeline();
  if (prefersReduced) return tl;
  tl.to(panel, { opacity: 0, y: 40, scale: 0.95, duration: 0.25, ease: 'power2.in' })
    .to(overlay, { opacity: 0, duration: 0.2 }, '-=0.15');
  return tl;
};

export const bottomSheetEnter = (el) => {
  if (prefersReduced) return gsap.set(el, { opacity: 1, y: 0 });
  return gsap.fromTo(el,
    { opacity: 0, y: '100%' },
    { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }
  );
};

// ── Loading / skeleton ──────────────────────────────────────────────

export const shimmer = (el) => {
  if (prefersReduced) return;
  return gsap.to(el,
    { backgroundPosition: '200% 0', duration: 1.5, repeat: -1, ease: 'none' }
  );
};

// ── Vinyl / continuous ──────────────────────────────────────────────

export const spinContinuous = (el, opts = {}) => {
  return gsap.to(el,
    { rotation: '+=360', duration: opts.duration ?? 3, repeat: -1, ease: 'none', ...opts }
  );
};

export { gsap, prefersReduced };

// Re-export backward-compatible names
export const prefersReducedMotion = () => prefersReduced;
export const initGSAP = () => {
  gsap.defaults({ duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
  gsap.config({ force3D: true, nullTargetWarn: false });
};
export const EASE = {
  smooth: 'power3.out',
  bounce: 'elastic.out(1, 0.5)',
  snap: 'back.out(1.7)',
  gentle: 'power2.inOut',
  cinematic: 'power4.inOut',
  pop: 'back.out(2)',
  slide: 'power3.out',
  elastic: 'elastic.out(1, 0.4)',
};
export const DURATION = {
  fast: 0.3,
  normal: 0.5,
  slow: 0.8,
  cinematic: 1.2,
};
