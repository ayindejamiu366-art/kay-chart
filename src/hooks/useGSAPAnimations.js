import { useRef, useCallback, useEffect } from 'react';
import { gsap, prefersReduced } from '../utils/gsap';

/**
 * Hook for GSAP animations with automatic cleanup on unmount.
 * Returns a ref to attach to the target element and an animate function.
 */
export function useGSAPAnimation(animationFn, deps = []) {
  const ref = useRef(null);
  const animRef = useRef(null);

  const animate = useCallback(() => {
    if (!ref.current) return null;
    if (animRef.current) animRef.current.kill?.();
    animRef.current = animationFn(ref.current);
    return animRef.current;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (animRef.current) {
        animRef.current.kill?.();
        animRef.current = null;
      }
    };
  }, []);

  return { ref, animate };
}

/**
 * Hook for stagger animations on a list of items.
 * Returns a containerRef and an itemsRef callback.
 */
export function useStaggerAnimation(staggerFn, deps = []) {
  const containerRef = useRef(null);
  const itemsRef = useRef([]);
  const animRef = useRef(null);

  const setItemRef = useCallback((el, index) => {
    if (el) itemsRef.current[index] = el;
  }, []);

  const animate = useCallback(() => {
    if (animRef.current) animRef.current.kill?.();
    const elements = itemsRef.current.filter(Boolean);
    if (elements.length === 0) return null;
    animRef.current = staggerFn(elements, containerRef.current);
    return animRef.current;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (animRef.current) {
        animRef.current.kill?.();
        animRef.current = null;
      }
    };
  }, []);

  return { containerRef, setItemRef, animate, itemsRef };
}

/**
 * Check if reduced motion is preferred.
 */
export { prefersReduced };
