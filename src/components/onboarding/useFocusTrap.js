import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Traps keyboard focus inside a container while `active`, restores focus to the
 * previously focused element on close, and wires Escape.
 *
 * The project has no focus-trap or portal utility, so this is intentionally
 * small and dependency-free rather than pulling in a library for ~30 lines.
 */
export function useFocusTrap(containerRef, active, onEscape) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    previousFocusRef.current = document.activeElement;
    const container = containerRef.current;

    const focusFirst = () => {
      if (!container) return;
      const nodes = container.querySelectorAll(FOCUSABLE);
      if (nodes.length) nodes[0].focus();
      else container.focus();
    };
    // Wait a frame so entrance animations do not fight the initial focus.
    const raf = window.requestAnimationFrame(focusFirst);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onEscape?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const nodes = container ? Array.from(container.querySelectorAll(FOCUSABLE)) : [];
      if (!nodes.length) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [active, containerRef, onEscape]);
}
