import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useApp } from '../hooks/useApp';
import { detectCountry, detectLanguage, getCountryName } from '../utils/country';
import api from '../services/api';
import gsap from 'gsap';

const LANG_LABELS = {
  en: 'English', es: 'Español', fr: 'Français', ar: 'العربية', hi: 'हिन्दी',
  ta: 'தமிழ்', de: 'Deutsch', zh: '中文', ja: '日本語', ko: '한국어',
  pt: 'Português', ru: 'Русский', tr: 'Türkçe',
};

function WelcomePopup({ name, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    gsap.fromTo(el.querySelector('.popup-card'),
      { scale: 0.8, opacity: 0, y: 40 },
      { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.4)' }
    );
    gsap.fromTo(el.querySelector('.popup-icon'),
      { scale: 0, rotation: -180 },
      { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2)', delay: 0.15 }
    );
    gsap.fromTo(el.querySelectorAll('.popup-text'),
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, stagger: 0.08, duration: 0.4, delay: 0.3, ease: 'power2.out' }
    );
  }, []);
  return (
    <div ref={ref} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="popup-card bg-surface-card/90 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mx-6 max-w-sm w-full flex flex-col items-center text-center shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="popup-icon w-20 h-20 rounded-full bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center mb-5 shadow-[0_0_50px_rgba(214,255,61,0.4)]">
          <span className="material-symbols-outlined text-background text-[36px] icon-fill">waving_hand</span>
        </div>
        <h2 className="popup-text font-headline-xl text-headline-xl text-on-surface mb-2">Welcome, {name}!</h2>
        <p className="popup-text font-body-md text-body-md text-on-surface-variant mb-6">Ready to discover your sound? Let's set up your taste.</p>
        <button onClick={onClose} className="popup-text w-full h-12 rounded-full bg-primary text-background font-body-md text-body-md font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform">
          <span>Let's Go</span>
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}

function LanguagePromptPopup({ detectedLang, onKeepEnglish, onSwitchLanguage, switching }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current.querySelector('.lp-card'),
      { scale: 0.85, opacity: 0, y: 30 },
      { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.3)' }
    );
  }, []);
  const nativeLabel = LANG_LABELS[detectedLang.code] || detectedLang.name;
  return (
    <div ref={ref} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="lp-card bg-surface-card/90 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mx-6 max-w-sm w-full flex flex-col items-center text-center shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center mb-5 shadow-[0_0_50px_rgba(139,92,246,0.4)]">
          <span className="material-symbols-outlined text-white text-[36px]">translate</span>
        </div>
        <h2 className="font-headline-xl text-headline-xl text-on-surface mb-2">Language Preference</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-1">
          We detected you're from <span className="text-on-surface font-semibold">{detectedLang.countryName}</span>.
        </p>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
          Would you like to use Kay Chart in <span className="text-primary font-semibold">{nativeLabel}</span>?
        </p>
        {switching ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="font-body-sm text-on-surface-variant text-sm">Switching language...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            <button onClick={onSwitchLanguage} className="w-full h-12 rounded-full bg-primary text-background font-body-md text-body-md font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform">
              <span className="material-symbols-outlined text-[20px]">check</span>
              Switch to {nativeLabel}
            </button>
            <button onClick={onKeepEnglish} className="w-full h-12 rounded-full bg-white/5 border border-white/10 text-on-surface-variant font-body-md text-body-md hover:bg-white/10 transition-colors">
              Stay in English
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignUp() {
  const navigate = useNavigate();
  const { t, lang: currentLang, setLang } = useI18n();
  const { user, loading: appLoading, authChecked, googleSignIn } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  // True once the email is known to belong to an existing account, which swaps
  // the error into a "sign in instead" recovery path.
  const [emailIsTaken, setEmailIsTaken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLangPrompt, setShowLangPrompt] = useState(false);
  const [detectedLang, setDetectedLang] = useState(null);
  const [langSwitching, setLangSwitching] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [step, setStep] = useState(1);

  const bgRef = useRef(null);
  const cardRef = useRef(null);
  const orb1 = useRef(null);
  const orb2 = useRef(null);
  const orb3 = useRef(null);

  useEffect(() => {
    if (authChecked && !appLoading && user) {
      navigate(user.profileSetupCompleted === false ? '/profile-setup' : '/home', { replace: true });
    }
  }, [user, appLoading, authChecked, navigate]);

  const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Background orbs float
  useEffect(() => {
    if (prefersReduced) return;
    const tls = [];
    [orb1, orb2, orb3].forEach((ref, i) => {
      if (!ref.current) return;
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(ref.current, {
        x: gsap.utils.random(-40, 40),
        y: gsap.utils.random(-40, 40),
        scale: gsap.utils.random(0.8, 1.2),
        duration: gsap.utils.random(4, 7),
        ease: 'sine.inOut',
      });
      tls.push(tl);
    });
    return () => tls.forEach(tl => tl.kill());
  }, []);

  // Card entrance
  useEffect(() => {
    if (prefersReduced || !cardRef.current) return;
    try {
      const tl = gsap.timeline({ delay: 0.1 });
      tl.from(cardRef.current,
        { y: 50, scale: 0.95, duration: 0.6, ease: 'power3.out' }
      );
      tl.from(cardRef.current.querySelectorAll('.field'),
        { x: -20, stagger: 0.07, duration: 0.35, ease: 'power2.out' },
        '-=0.3'
      );
      tl.from(cardRef.current.querySelector('.submit-btn'),
        { y: 10, duration: 0.35, ease: 'power2.out' },
        '-=0.1'
      );
      tl.from(cardRef.current.querySelectorAll('.divider-text, .social-btn, .footer-link'),
        { stagger: 0.06, duration: 0.3 },
        '-=0.1'
      );
      return () => tl.kill();
    } catch (e) {
      if (cardRef.current) cardRef.current.style.opacity = '1';
    }
  }, [step]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError(t('SIGNUP_ERROR_FILL_FIELDS'));
      return;
    }
    if (password.length < 6) {
      setError(t('SIGNUP_ERROR_PASSWORD_MIN'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('SIGNUP_ERROR_INVALID_EMAIL'));
      return;
    }
    setLoading(true);
    try {
      await api.generateOTP(email.trim().toLowerCase(), 'signup');
      navigate('/verify-otp', {
        replace: true,
        state: { email: email.trim().toLowerCase(), isNew: true, pendingUser: { name: name.trim(), email: email.trim().toLowerCase(), role }, password }
      });
      } catch (err) {
        setError(err.message || 'Failed to send verification code');
        setEmailIsTaken(err.status === 409 || err.code === 'EMAIL_TAKEN');
      }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await googleSignIn();
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    }
    setLoading(false);
  };

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    // A Google-created account still has to finish profile setup, so the
    // post-welcome hand-off always lands on the wizard.
    const afterWelcome = () => navigate('/profile-setup', { replace: true });
    if (currentLang !== 'en') {
      afterWelcome();
      return;
    }
    const country = detectCountry();
    const lang = detectLanguage(country);
    if (lang.code === 'en' || !lang.isSupported) {
      afterWelcome();
      return;
    }
    setDetectedLang({ ...lang, countryName: getCountryName(country) });
    setShowLangPrompt(true);
  };

  const handleKeepEnglish = () => {
    setShowLangPrompt(false);
    navigate('/profile-setup', { replace: true });
  };

  const handleSwitchLanguage = async () => {
    if (!detectedLang) return;
    setLangSwitching(true);
    try { await setLang(detectedLang.code); } catch {} // eslint-disable-line no-empty
    setTimeout(() => {
      setLangSwitching(false);
      setShowLangPrompt(false);
      navigate('/profile-setup', { replace: true });
    }, 600);
  };

  return (
    <div ref={bgRef} className="auth-screen min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0d0d0d]" />
      <div ref={orb1} className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]" />
      <div ref={orb2} className="absolute bottom-[-10%] right-[-15%] w-[400px] h-[400px] rounded-full bg-secondary/8 blur-[100px]" />
      <div ref={orb3} className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-purple-500/5 blur-[80px]" />

      {showWelcome && <WelcomePopup name={pendingName} onClose={handleWelcomeClose} />}
      {showLangPrompt && detectedLang && (
        <LanguagePromptPopup
          detectedLang={detectedLang}
          onKeepEnglish={handleKeepEnglish}
          onSwitchLanguage={handleSwitchLanguage}
          switching={langSwitching}
        />
      )}

      {/* Card */}
      <div ref={cardRef} className="relative z-10 w-full max-w-md fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(214,255,61,0.35)]">
            <span className="material-symbols-outlined text-background text-[32px] icon-fill">music_note</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Create your account</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">Start your music journey</p>
        </div>

        {/* Error */}
        {error && (
          <div className="field mb-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5" role="alert">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-red-400 text-[18px]" aria-hidden="true">error</span>
              <p className="font-body-sm text-body-sm text-red-400">{error}</p>
            </div>
            {emailIsTaken && (
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2.5 pt-2.5 border-t border-red-500/20">
                An account with this email already exists.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/sign-in', { replace: true, state: { email: email.trim().toLowerCase() } })}
                  className="text-primary underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  Sign in instead
                </button>.
              </p>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="field relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[20px]">person</span>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 focus:bg-primary/5 transition-all duration-300"
            />
          </div>
          <div className="field relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[20px]">mail</span>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 focus:bg-primary/5 transition-all duration-300"
            />
          </div>
          <div className="field relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[20px]">lock</span>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Create a password"
              className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 focus:bg-primary/5 transition-all duration-300"
            />
          </div>

          {/* Role selector */}
          <div className="field flex gap-3 mt-1">
            <button type="button" onClick={() => setRole('user')}
              className={`flex-1 h-14 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all duration-300 press-feedback ${role === 'user' ? 'border-primary bg-primary/10 text-primary shadow-[0_0_20px_rgba(214,255,61,0.15)]' : 'border-white/[0.08] bg-white/[0.02] text-on-surface-variant hover:border-white/20'}`}>
              <span className="material-symbols-outlined text-[20px]">headphones</span>
              <span className="font-body-sm text-body-sm font-medium">Listener</span>
            </button>
            <button type="button" onClick={() => setRole('artist')}
              className={`flex-1 h-14 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all duration-300 press-feedback ${role === 'artist' ? 'border-primary bg-primary/10 text-primary shadow-[0_0_20px_rgba(214,255,61,0.15)]' : 'border-white/[0.08] bg-white/[0.02] text-on-surface-variant hover:border-white/20'}`}>
              <span className="material-symbols-outlined text-[20px]">mic</span>
              <span className="font-body-sm text-body-sm font-medium">Artist</span>
            </button>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="submit-btn w-full h-14 rounded-full bg-primary text-background font-body-md text-body-md font-bold flex items-center justify-center gap-2.5 mt-2 hover:shadow-[0_0_30px_rgba(214,255,61,0.3)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (
              <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
            ) : (
              <>
                Create Account
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="divider-text flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-on-surface-variant/50 font-body-xs text-body-xs uppercase tracking-wider">or continue with</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        {/* Social */}
        <button onClick={handleGoogleSignIn}
          className="social-btn w-full h-12 rounded-full bg-white/[0.04] border border-white/[0.08] text-on-surface font-body-md text-body-md flex items-center justify-center gap-3 hover:bg-white/[0.08] transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google
        </button>

        {/* Footer */}
        <p className="footer-link text-center mt-6 font-body-sm text-body-sm text-on-surface-variant">
          Already have an account?{' '}
          <Link to="/sign-in" className="text-primary font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
