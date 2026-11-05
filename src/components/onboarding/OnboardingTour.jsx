import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReduced } from '../../utils/gsap';
import { TOUR_STEPS } from './onboardingConfig';
import { useFocusTrap } from './useFocusTrap';
import TourCard from './TourCard';

const EDGE_GAP = 14;
const VIEWPORT_MARGIN = 16;
const RING_RADIUS = 18;

/**
 * Finds the tour target for a step.
 *
 * The same destination is rendered twice — AppSidebar (desktop) and BottomNav
 * (mobile) — and the inactive one stays in the DOM but hidden, so a plain
 * querySelector would happily spotlight an invisible element.
 */
function findTarget(key) {
  if (!key) return null;
  const nodes = Array.from(document.querySelectorAll(`[data-tour="${key}"]`));
  return (
    nodes.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || null
  );
}

export default function OnboardingTour({ stepIndex, setStepIndex, onFinish, onSkip }) {
  const step = TOUR_STEPS[stepIndex];
  const isFinal = stepIndex === TOUR_STEPS.length - 1;

  const [rect, setRect] = useState(null);
  const [position, setPosition] = useState({ left: VIEWPORT_MARGIN, top: VIEWPORT_MARGIN, placement: 'center' });
  const [hasTarget, setHasTarget] = useState(false);

  const cardRef = useRef(null);
  const shellRef = useRef(null);
  const targetElRef = useRef(null);

  // Escape is treated as "skip" so the tour can always be escaped.
  useFocusTrap(cardRef, true, onSkip);

  const measure = useCallback(() => {
    const el = targetElRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!el) {
      setHasTarget(false);
      setRect(null);
      const card = cardRef.current;
      const cw = card?.offsetWidth || 336;
      const ch = card?.offsetHeight || 320;
      setPosition({
        left: Math.max(VIEWPORT_MARGIN, (vw - cw) / 2),
        top: Math.max(VIEWPORT_MARGIN, (vh - ch) / 2),
        placement: 'center',
      });
      return;
    }

    setHasTarget(true);
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.top, width: r.width, height: r.height });

    const card = cardRef.current;
    const cw = card?.offsetWidth || Math.min(336, vw - VIEWPORT_MARGIN * 2);
    const ch = card?.offsetHeight || 300;

    // Bottom navigation on mobile has to be called out from above, otherwise the
    // card would sit underneath it or run off the bottom of the screen.
    const nearBottom = r.top > vh * 0.65;
    const nearLeftEdge = r.right < vw * 0.35;

    let left;
    let top;
    let placement;

    if (nearBottom) {
      placement = 'above';
      left = r.left + r.width / 2 - cw / 2;
      top = r.top - ch - EDGE_GAP;
    } else if (nearLeftEdge) {
      placement = 'right';
      left = r.right + EDGE_GAP;
      top = r.top + r.height / 2 - ch / 2;
    } else {
      placement = 'below';
      left = r.left + r.width / 2 - cw / 2;
      top = r.bottom + EDGE_GAP;
    }

    // Never let the card leave the viewport, whatever the target position is.
    left = Math.min(Math.max(VIEWPORT_MARGIN, left), Math.max(VIEWPORT_MARGIN, vw - cw - VIEWPORT_MARGIN));
    top = Math.min(Math.max(VIEWPORT_MARGIN, top), Math.max(VIEWPORT_MARGIN, vh - ch - VIEWPORT_MARGIN));

    setPosition({ left, top, placement });
  }, []);

  // Re-resolve the target whenever the step changes.
  useLayoutEffect(() => {
    const el = findTarget(step.target);
    targetElRef.current = el;
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, step.target]);

  // Keep the spotlight pinned to the element while the page scrolls or resizes.
  useEffect(() => {
    const onReflow = () => measure();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    let observer;
    if (typeof ResizeObserver !== 'undefined' && targetElRef.current) {
      observer = new ResizeObserver(onReflow);
      observer.observe(targetElRef.current);
    }
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
      observer?.disconnect();
    };
  }, [measure, stepIndex]);

  // Soft entrance for the card on every step.
  useGSAP(() => {
    const card = cardRef.current;
    if (!card) return;
    if (prefersReduced) {
      gsap.set(card, { opacity: 1, y: 0, scale: 1 });
      return;
    }
    gsap.fromTo(
      card,
      { opacity: 0, y: 12, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out', overwrite: 'auto' }
    );
  }, { dependencies: [stepIndex] });

  // Re-measure once fonts/layout settle so the clamp uses final measurements.
  useEffect(() => {
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
  }, [measure, stepIndex]);

  // Changing step can unmount the button that had focus (Back disappears on the
  // first step), which would silently drop focus to <body>. Re-seat it on the
  // dialog whenever focus no longer lives inside the card.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (card.contains(document.activeElement)) return;
    card.focus();
  }, [stepIndex]);

  const goNext = () => {
    if (isFinal) onFinish();
    else setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));
  const canGoBack = stepIndex > 0;

  const transition = prefersReduced ? '' : 'transition-all duration-300 ease-out';
  const ring = rect && hasTarget;

  return createPortal(
    <div ref={shellRef} className="fixed inset-0 z-[118]" data-onboarding-tour>
      {ring ? (
        <>
          {/* Four panes around the target instead of one full-screen scrim, so the
              highlighted element stays visible AND tappable. */}
          <div className={`absolute bg-black/75 ${transition}`} style={{ left: 0, top: 0, width: '100%', height: Math.max(0, rect.top) }} />
          <div className={`absolute bg-black/75 ${transition}`} style={{ left: 0, top: rect.top + rect.height, width: '100%', height: Math.max(0, window.innerHeight - rect.top - rect.height) }} />
          <div className={`absolute bg-black/75 ${transition}`} style={{ left: 0, top: rect.top, width: Math.max(0, rect.left), height: rect.height }} />
          <div className={`absolute bg-black/75 ${transition}`} style={{ left: rect.left + rect.width, top: rect.top, width: Math.max(0, window.innerWidth - rect.left - rect.width), height: rect.height }} />
          {/* Spotlight ring + glow */}
          <div
            aria-hidden="true"
            className={`absolute pointer-events-none border border-primary/70 shadow-[0_0_0_1px_rgba(214,255,61,0.25),0_0_28px_rgba(214,255,61,0.35)] ${transition}`}
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: RING_RADIUS }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/80" />
      )}

      <TourCard
        ref={cardRef}
        step={step}
        index={stepIndex}
        total={TOUR_STEPS.length}
        position={position}
        isFinal={isFinal}
        canGoBack={canGoBack}
        onBack={goBack}
        onNext={goNext}
        onSkip={onSkip}
      />

      {/* Screen-reader announcement of the step change. */}
      <p aria-live="polite" className="sr-only">
        Step {stepIndex + 1} of {TOUR_STEPS.length}. {step.title}.
      </p>
    </div>,
    document.body
  );
}
