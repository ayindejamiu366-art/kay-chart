import { forwardRef } from 'react';
import { TOUR_STEPS } from './onboardingConfig';

/**
 * The tour tooltip. Kept presentational: it receives an already-computed
 * position so it never has to reason about the viewport itself.
 */
const TourCard = forwardRef(function TourCard(
  { step, index, total, position, onBack, onNext, onSkip, isFinal, canGoBack },
  ref
) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
      aria-describedby="onboarding-tour-desc"
      tabIndex={-1}
      className="fixed z-[122] w-[calc(100vw-32px)] max-w-[336px] pointer-events-auto focus:outline-none"
      style={position}
    >
      <div
        className="bg-surface-card/95 backdrop-blur-xl border border-primary/25 rounded-3xl p-5 shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
        // Arrow points back at the highlighted element.
        data-placement={position?.placement}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[22px]">{step.icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="onboarding-tour-title" className="font-headline-md text-headline-md text-on-surface leading-tight">
              {step.title}
            </h2>
            <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
              Step {index + 1} of {total}
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip the tour"
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-surface-card -mt-1 -mr-1"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <p id="onboarding-tour-desc" className="font-body-sm text-body-sm text-on-surface-variant mb-4">
          {step.description}
        </p>

        <div className="flex items-center gap-1.5 mb-4" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} aria-label="Tour progress">
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.id}
              aria-hidden="true"
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-primary' : i < index ? 'w-1.5 bg-primary/45' : 'w-1.5 bg-on-surface-variant/25'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className="h-11 px-4 rounded-full border border-border-subtle text-on-surface-variant font-body-sm text-body-sm press-feedback focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-surface-card hover:border-primary/40 hover:text-on-surface transition-colors"
            >
              Back
            </button>
          )}

          {isFinal ? (
            <button
              type="button"
              onClick={onNext}
              className="h-11 flex-1 px-4 rounded-full btn-primary font-body-sm text-body-sm flex items-center justify-center gap-1.5 press-feedback focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-surface-card"
            >
              Start Listening
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="h-11 flex-1 px-4 rounded-full btn-primary font-body-sm text-body-sm flex items-center justify-center gap-1.5 press-feedback focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-surface-card"
            >
              Next
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSkip}
            className="h-11 px-3 rounded-full text-[13px] text-on-surface-variant hover:text-on-surface press-feedback focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-surface-card"
          >
            Skip
          </button>
        </div>

        {isFinal && (
          <button
            type="button"
            onClick={onNext}
            className="mt-2 w-full h-11 rounded-full border border-border-subtle text-on-surface-variant font-body-sm text-body-sm press-feedback focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-surface-card hover:border-primary/40 transition-colors"
          >
            Explore Kay Chart
          </button>
        )}
      </div>
    </div>
  );
});

export default TourCard;
