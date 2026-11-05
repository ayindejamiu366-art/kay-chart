import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useApp } from '../hooks/useApp';
import api from '../services/api';
import gsap from 'gsap';

const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { user, loading: appLoading, authChecked, googleSignIn } = useApp();
  // Pre-filled when the user arrives from the "email already in use" path.
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // The sign-in endpoint answers generically for an unknown email so it cannot be
  // used to enumerate accounts. This flag drives the recovery affordance instead:
  // once the user has failed to sign in, we offer a way to create the account
  // without the server ever confirming whether it existed.
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  const cardRef = useRef(null);
  const orb1 = useRef(null);
  const orb2 = useRef(null);
  const orb3 = useRef(null);

  useEffect(() => {
    if (authChecked && !appLoading && user) {
      navigate(user.profileSetupCompleted === false ? '/profile-setup' : '/home', { replace: true });
    }
  }, [user, appLoading, authChecked, navigate]);

  // Background orbs float
  useEffect(() => {
    if (prefersReduced) return;
    const tls = [];
    [orb1, orb2, orb3].forEach((ref) => {
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
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError(t('SIGNIN_ERROR_FILL_FIELDS'));
      return;
    }
    setLoading(true);
    try {
      const result = await api.signinRequest(email.trim().toLowerCase(), password);
      if (result.pendingToken) {
        await api.generateOTP(email.trim().toLowerCase(), 'signin', result.pendingToken);
        navigate('/verify-otp', {
          replace: true,
          state: { email: email.trim().toLowerCase(), isNew: false, pendingToken: result.pendingToken }
        });
      }
    } catch (err) {
      // The message is the server's, which is deliberately identical whether the
      // email is unknown or the password is wrong.
      setError(err.message || 'Sign in failed');
      setShowCreateAccount(true);
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

  return (
    <div className="auth-screen min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0d0d0d]" />
      <div ref={orb1} className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]" />
      <div ref={orb2} className="absolute bottom-[-10%] left-[-15%] w-[400px] h-[400px] rounded-full bg-secondary/8 blur-[100px]" />
      <div ref={orb3} className="absolute top-[30%] left-[10%] w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[80px]" />

      {/* Card */}
      <div ref={cardRef} className="relative z-10 w-full max-w-md fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(214,255,61,0.35)]">
            <span className="material-symbols-outlined text-background text-[32px] icon-fill">music_note</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Welcome back</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">Sign in to continue listening</p>
        </div>

        {/* Success (e.g. password reset completed) */}
        {location.state?.message && (
          <div className="field mb-4 bg-green-500/10 border border-green-500/30 rounded-2xl p-3.5" role="status">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-green-400 text-[18px]" aria-hidden="true">check_circle</span>
              <p className="font-body-sm text-body-sm text-green-400">{location.state.message}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="field mb-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5" role="alert">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-red-400 text-[18px]" aria-hidden="true">error</span>
              <p className="font-body-sm text-body-sm text-red-400">{error}</p>
            </div>
            {showCreateAccount && (
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2.5 pt-2.5 border-t border-red-500/20">
                No account yet, or you have forgotten your password?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/sign-up', { replace: true })}
                  className="text-primary underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  Create an account
                </button>{' '}
                or{' '}
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password', { replace: true })}
                  className="text-primary underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  reset your password
                </button>.
              </p>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
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
              placeholder="Password"
              className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/60 focus:bg-primary/5 transition-all duration-300"
            />
          </div>

          <div className="flex justify-end -mt-1">
            <Link to="/forgot-password" className="font-body-xs text-body-xs text-primary/80 hover:text-primary transition-colors">
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="submit-btn w-full h-14 rounded-full bg-primary text-background font-body-md text-body-md font-bold flex items-center justify-center gap-2.5 mt-1 hover:shadow-[0_0_30px_rgba(214,255,61,0.3)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (
              <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
            ) : (
              <>
                Sign In
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
          Don't have an account?{' '}
          <Link to="/sign-up" className="text-primary font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
