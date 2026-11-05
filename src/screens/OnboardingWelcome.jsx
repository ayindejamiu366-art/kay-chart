import { useNavigate } from 'react-router-dom';
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';

export default function OnboardingWelcome() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const logoRef = useRef(null);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const buttonsRef = useRef(null);

  useEffect(() => {
    if (prefersReduced) return;
    const tl = gsap.timeline({ delay: 0.2 });
    tl.from(logoRef.current, { scale: 0, rotation: -90, opacity: 0, duration: 0.7, ease: 'back.out(1.7)' })
      .from(titleRef.current, { y: 30, opacity: 0, duration: 0.5, ease: 'power3.out' }, '-=0.3')
      .from(descRef.current, { y: 20, opacity: 0, duration: 0.4, ease: 'power3.out' }, '-=0.2')
      .from(buttonsRef.current?.children || [], { y: 20, opacity: 0, duration: 0.4, stagger: 0.1, ease: 'power3.out' }, '-=0.1');
    return () => tl.kill();
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* The Kay Chart mark, as the real SVG asset. `logoRef` is kept so the
            existing entrance animation is unchanged. */}
        <div ref={logoRef} className="w-24 h-24 mb-8" style={{ willChange: 'transform' }}>
          <img
            src="/brand/kay-chart-mark.svg"
            alt=""
            aria-hidden="true"
            width={96}
            height={96}
            className="w-full h-full"
          />
        </div>
        <h1 ref={titleRef} className="font-headline-xl text-headline-xl text-on-surface text-center mb-3">
          Kay Chart
        </h1>
        <p ref={descRef} className="font-body-md text-body-md text-on-surface-variant text-center mb-12 leading-relaxed">
          Stream, discover, and share music. Powered by AI to match your vibe.
        </p>
        <div ref={buttonsRef} className="w-full flex flex-col gap-3">
          <button
            onClick={() => navigate('/sign-up')}
            className="w-full h-14 rounded-full btn-primary font-headline-md text-headline-md flex items-center justify-center gap-2"
          >
            Get Started
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
          <button
            onClick={() => navigate('/sign-in')}
            className="w-full h-14 rounded-full bg-surface-card border border-border-subtle text-on-surface font-body-md text-body-md hover:border-primary/40 transition-colors press-feedback"
          >
            I already have an account
          </button>
        </div>
      </div>
    </div>
  );
}
