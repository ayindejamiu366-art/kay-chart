import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReduced } from '../utils/gsap';

export function useGsapAnimation(deps = [], options = {}) {
  const containerRef = useRef(null);
  const ctx = useRef(null);

  const { enabled = true } = options;

  useGSAP(() => {
    if (!enabled || prefersReduced || !containerRef.current) return;

    const cleanup = () => {
      if (ctx.current) {
        ctx.current.revert();
        ctx.current = null;
      }
    };

    ctx.current = gsap.context(() => {}, containerRef);

    return cleanup;
  }, { scope: containerRef, dependencies: deps });

  return { containerRef };
}

export function useStagger(selector, containerRef, options = {}) {
  const { delay = 0, duration = 0.5, y = 20, stagger = 0.06, ease = 'power3.out', enabled = true } = options;

  useGSAP(() => {
    if (!enabled || prefersReduced || !containerRef.current) return;

    const elements = containerRef.current.querySelectorAll(selector);
    if (!elements.length) return;

    gsap.set(elements, { opacity: 0, y });

    gsap.to(elements, {
      opacity: 1,
      y: 0,
      duration,
      delay,
      stagger,
      ease,
      overwrite: 'auto',
    });
  }, { scope: containerRef, dependencies: [selector, enabled] });
}

export function useEntrance(containerRef, options = {}) {
  const { delay = 0, y = 30, duration = 0.6, enabled = true } = options;

  useGSAP(() => {
    if (!enabled || prefersReduced || !containerRef.current) return;

    gsap.from(containerRef.current, {
      opacity: 0,
      y,
      duration,
      delay,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }, { scope: containerRef, dependencies: [enabled] });
}
