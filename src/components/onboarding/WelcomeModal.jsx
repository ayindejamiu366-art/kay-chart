import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReduced } from '../../utils/gsap';
import { useFocusTrap } from './useFocusTrap';

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

/**
 * First screen a brand new account sees. Rendered in a portal so it is never
 * trapped by a transformed ancestor (PageTransition sets a transform while
 * animating, which makes it the containing block for fixed children).
 */
export default function WelcomeModal({ onStartTour, onDismiss, user }) {
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const panelRef = useRef(null);

  const name = firstName(user?.name);
  const heading = name ? `Welcome to Kay Chart, ${name}` : 'Welcome to Kay Chart';

  useFocusTrap(panelRef, true, onDismiss);

  useGSAP(() => {
    if (prefersReduced) {
      gsap.set([overlayRef.current, cardRef.current], { opacity: 1, y: 0, scale: 1 });
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' })
      .fromTo(
        cardRef.current,
        { opacity: 0, y: 28, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' },
        '-=0.1'
      )
      .fromTo(
        '[data-welcome-line]',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.07, ease: 'power3.out' },
        '-=0.2'
      );
    return () => tl.kill();
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm px-5"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-welcome-title"
        aria-describedby="onboarding-welcome-body"
        tabIndex={-1}
        className="relative w-full max-w-md outline-none"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-primary/20 blur-[90px]"
        />

        <div
          ref={cardRef}
          className="relative bg-surface-card/90 backdrop-blur-xl border border-primary/20 rounded-3xl p-6 sm:p-7 shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
        >
          <div data-welcome-line className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[26px] icon-fill">music_note</span>
            </div>
            <div className="min-w-0">
              <p className="font-label-lg text-label-lg uppercase tracking-wider text-primary">Kay Chart</p>
              <p className="text-[13px] text-on-surface-variant">Your music, all in one place</p>
            </div>
          </div>

          <h1
            id="onboarding-welcome-title"
            data-welcome-line
            className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-2"
          >
            {heading}
          </h1>

          <p id="onboarding-welcome-body" data-welcome-line className="font-body-md text-body-md text-on-surface-variant mb-5">
            Your music journey starts here. Discover music, find artists you love, build your queue, and enjoy your
            favourite tracks.
          </p>

          <div data-welcome-line className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <button
              type="button"
              onClick={onStartTour}
              className="h-12 px-6 rounded-full btn-primary font-body-sm text-body-sm flex-1 flex items-center justify-center gap-1.5 press-feedback focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-surface-card"
            >
              Start the tour
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="h-12 px-6 rounded-full bg-surface-card border border-border-subtle text-on-surface-variant font-body-sm text-body-sm flex-1 press-feedback focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-surface-card hover:border-primary/40 transition-colors"
            >
              Maybe later
            </button>
          </div>

          <p data-welcome-line className="mt-4 text-[11px] text-on-surface-variant/60 text-center sm:text-left">
            Press <kbd className="px-1 rounded bg-surface-card border border-border-subtle">Esc</kbd> to skip for now.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
