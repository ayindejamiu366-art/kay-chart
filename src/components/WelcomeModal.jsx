import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';

export default function WelcomeModal() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const avatarRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const shown = localStorage.getItem('nocturne_welcome_shown_' + user?.id);
    if (!shown && user) {
      setTimeout(() => setVisible(true), 500);
    }
  }, [user]);

  useEffect(() => {
    if (!visible || prefersReduced) return;
    const tl = gsap.timeline();
    tl.from(overlayRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' })
      .from(avatarRef.current, { scale: 0, rotation: -180, duration: 0.6, ease: 'back.out(1.7)' }, '-=0.1')
      .from(cardRef.current, { y: 40, opacity: 0, scale: 0.95, duration: 0.5, ease: 'power3.out' }, '-=0.2')
      .from(contentRef.current?.children || [], { y: 15, opacity: 0, stagger: 0.08, duration: 0.35, ease: 'power3.out' }, '-=0.2');
    return () => tl.kill();
  }, [visible]);

  useEffect(() => {
    if (!visible || prefersReduced) return;
    gsap.fromTo(cardRef.current,
      { y: 20, opacity: 0, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out', overwrite: 'auto' }
    );
  }, [step, visible]);

  const dismiss = () => {
    if (prefersReduced) {
      localStorage.setItem('nocturne_welcome_shown_' + user?.id, 'true');
      setVisible(false);
      return;
    }
    gsap.to(cardRef.current, {
      y: 20, opacity: 0, scale: 0.95, duration: 0.25, ease: 'power2.in',
      onComplete: () => {
        localStorage.setItem('nocturne_welcome_shown_' + user?.id, 'true');
        setVisible(false);
      }
    });
  };

  if (!visible) return null;

  const features = [
    { icon: 'headphones', title: 'Your Music, Your Way', desc: 'Stream millions of tracks from your favorite artists — Tamil, Pop, EDM, and more.' },
    { icon: 'auto_awesome', title: 'AI-Powered DJ', desc: 'Our AI learns your taste and creates perfect playlists for any mood or moment.' },
    { icon: 'mic', title: 'Artist Uploads', desc: 'Artists can upload and share their music directly with listeners worldwide.' },
    { icon: 'download', title: 'Offline Listening', desc: 'Download your favorites and listen anywhere, even without internet.' },
  ];

  const currentFeature = features[step];

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && dismiss()}>
      <div className="w-full max-w-sm mx-6 flex flex-col items-center">
        <div className="absolute w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none animate-breathe" />

        <div ref={avatarRef} className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(214,255,61,0.4)]" style={{ willChange: 'transform' }}>
          <span className="material-symbols-outlined text-background text-[48px]">music_note</span>
        </div>

        <h1 className="font-headline-xl text-headline-xl text-on-surface text-center mb-2">
          Welcome, {user?.name?.split(' ')[0] || 'there'}!
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant text-center mb-8">
          You're all set. Here's what Kay Chart can do for you.
        </p>

        <div ref={cardRef} className="w-full bg-surface-card rounded-2xl p-6 border border-primary/20 border-glow mb-6">
          <div ref={contentRef}>
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-[28px]">{currentFeature.icon}</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{currentFeature.title}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{currentFeature.desc}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {features.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === step ? 'bg-primary w-6' : 'bg-on-surface-variant/30'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3 w-full">
          <button
            onClick={dismiss}
            className="flex-1 h-12 rounded-full bg-surface-card border border-border-subtle text-on-surface-variant font-body-sm text-body-sm hover:border-primary/40 transition-colors press-feedback"
          >
            Skip
          </button>
          {step < features.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 h-12 rounded-full btn-primary font-body-sm text-body-sm press-feedback"
            >
              Next
            </button>
          ) : (
            <button
              onClick={dismiss}
              className="flex-1 h-12 rounded-full btn-primary font-body-sm text-body-sm flex items-center justify-center gap-1 press-feedback"
            >
              Get Started
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
