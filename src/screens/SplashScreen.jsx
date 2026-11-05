import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReduced } from '../utils/gsap';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { user } = useApp();
  const containerRef = useRef(null);
  const iconRef = useRef(null);
  const textRef = useRef(null);
  const dotsRef = useRef([]);

  // Cinematic entrance
  useGSAP(() => {
    if (!containerRef.current || prefersReduced) return;
    const tl = gsap.timeline();
    tl.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 })
      .fromTo(iconRef.current,
        { scale: 0, rotation: -180, opacity: 0 },
        { scale: 1, rotation: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' },
        0.1
      )
      .fromTo(iconRef.current,
        { boxShadow: '0 0 0px rgba(214,255,61,0)' },
        { boxShadow: '0 0 40px rgba(214,255,61,0.4)', duration: 0.6, ease: 'power2.out' },
        0.5
      )
      .fromTo(textRef.current,
        { opacity: 0, y: 20, letterSpacing: '0.3em' },
        { opacity: 1, y: 0, letterSpacing: '0.15em', duration: 0.6, ease: 'power3.out' },
        0.6
      )
      .fromTo(dotsRef.current,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, stagger: 0.1, duration: 0.3, ease: 'back.out(2)' },
        0.9
      );
  }, []);

  // Loading dots pulse
  useGSAP(() => {
    if (prefersReduced || !dotsRef.current.length) return;
    gsap.to(dotsRef.current, {
      y: -4,
      stagger: { each: 0.15, repeat: -1, yoyo: true },
      duration: 0.3,
      ease: 'power2.inOut',
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(user ? '/home' : '/sign-in', { replace: true });
    }, 2200);
    return () => clearTimeout(timer);
  }, [user, navigate]);

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden fade-up">
      <div className="ambient-glow ambient-glow-animated" />
      <div className="relative z-10 flex flex-col items-center">
        {/*
          The Kay Chart mark, as the real SVG asset rather than a CSS or text
          stand-in. The wrapper keeps the element the existing entrance animation
          already targets (`iconRef`), so the splash timing and the Android
          startup sequence are unchanged.
        */}
        <div
          ref={iconRef}
          className="w-24 h-24 mb-6 scale-in"
        >
          <img
            src="/brand/kay-chart-mark.svg"
            alt=""
            aria-hidden="true"
            width={96}
            height={96}
            className="w-full h-full"
          />
        </div>
        <h1
          ref={textRef}
          className="font-headline-xl text-headline-xl text-on-surface tracking-widest fade-up fade-up-1"
          style={{ letterSpacing: '0.15em' }}
        >
          Kay Chart
        </h1>
        <p className="text-on-surface-variant text-sm mt-2 font-body-sm">Feel the rhythm</p>
        <div className="flex gap-1.5 mt-8">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              ref={el => { dotsRef.current[i] = el; }}
              className="w-2 h-2 rounded-full bg-primary scale-in"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
