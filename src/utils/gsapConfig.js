import { gsap } from 'gsap';

let initialized = false;

export function initGSAP() {
  if (initialized) return;
  initialized = true;

  gsap.defaults({
    duration: 0.6,
    ease: 'power3.out',
    overwrite: 'auto',
  });

  gsap.config({
    force3D: true,
    nullTargetWarn: false,
  });
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mq.matches;
}

export function gsapContext(callback, deps) {
  return {
    callback,
    deps,
  };
}

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
