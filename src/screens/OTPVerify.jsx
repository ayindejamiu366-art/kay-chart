import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useApp } from '../hooks/useApp';
import api from '../services/api';
import gsap from 'gsap';

const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function OTPVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { setUser: setAppUser } = useApp();
  const { email, pendingUser, pendingToken, isNew, password } = location.state || {};
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [resent, setResent] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  // Set when account creation is refused because the email is already in use, so
  // the screen can offer signing into that account instead of retrying signup.
  const [emailIsTaken, setEmailIsTaken] = useState(false);
  const inputRefs = useRef([]);
  const cardRef = useRef(null);
  const successRef = useRef(null);
  const orb1 = useRef(null);
  const orb2 = useRef(null);

  useEffect(() => {
    if (!email) { navigate(isNew ? '/sign-up' : '/sign-in', { replace: true }); return; }
    setTimeLeft(5 * 60 * 1000);
    const started = Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, 5 * 60 * 1000 - (Date.now() - started));
      setTimeLeft(left);
      if (left <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [email]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  // Background orbs
  useEffect(() => {
    if (prefersReduced) return;
    const tls = [];
    [orb1, orb2].forEach((ref) => {
      if (!ref.current) return;
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(ref.current, {
        x: gsap.utils.random(-30, 30), y: gsap.utils.random(-30, 30),
        scale: gsap.utils.random(0.85, 1.15), duration: gsap.utils.random(5, 8), ease: 'sine.inOut',
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
        { y: 40, scale: 0.95, duration: 0.5, ease: 'power3.out' }
      );
      tl.from(cardRef.current.querySelectorAll('.otp-input'),
        { y: 20, scale: 0.8, stagger: 0.05, duration: 0.3, ease: 'back.out(1.5)' },
        '-=0.2'
      );
      return () => tl.kill();
    } catch (e) {
      if (cardRef.current) cardRef.current.style.opacity = '1';
    }
  }, []);

  // Success animation
  useEffect(() => {
    if (!success || !successRef.current || prefersReduced) return;
    const tl = gsap.timeline();
    tl.fromTo(successRef.current.querySelector('.success-icon'),
      { scale: 0, rotation: -180 },
      { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2)' }
    );
    tl.fromTo(successRef.current.querySelector('.success-text'),
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
      '-=0.2'
    );
  }, [success]);

  // Animate input focus
  const animateInput = (index) => {
    if (prefersReduced || !inputRefs.current[index]) return;
    gsap.fromTo(inputRefs.current[index],
      { scale: 1.15, borderColor: 'rgba(214,255,61,0.8)' },
      { scale: 1, borderColor: 'rgba(214,255,61,0.3)', duration: 0.3, ease: 'power2.out' }
    );
  };

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError('');
    if (value) {
      animateInput(index);
      if (index < 5) inputRefs.current[index + 1]?.focus();
    }
    if (newDigits.every(d => d !== '')) handleVerify(newDigits.join(''));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      setError('');
      handleVerify(pasted);
    }
  };

  const handleVerify = async (code) => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    try {
      const result = await api.verifyOTP(email, code, isNew ? 'signup' : 'signin', pendingToken);
      if (result.error) {
        setError(result.error);
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setLoading(false);
        // Shake animation on error
        if (cardRef.current && !prefersReduced) {
          gsap.fromTo(cardRef.current, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
        }
      } else {
        setSuccess(true);
        setLoading(false);
        setTimeout(async () => {
            if (isNew && pendingUser) {
              try {
                const signupResult = await api.post('/auth/signup', {
                  name: pendingUser.name,
                  email: pendingUser.email,
                  password: password || 'google_oauth',
                  role: pendingUser.role,
                });
                if (signupResult.token) {
                  api.setToken(signupResult.token);
                  try { localStorage.setItem('nocturne_user', JSON.stringify(signupResult.user)); } catch {} // eslint-disable-line no-empty
                  setAppUser(signupResult.user);
                }
              } catch (e) {
                setError(e.message || 'Account creation failed');
                // The email is verified but the account already exists, which is
                // only knowable here — the signup POST is what finally commits.
                setEmailIsTaken(e.status === 409 || e.code === 'EMAIL_TAKEN');
                setLoading(false);
                setSuccess(false);
                return;
              }
              // A brand new account always starts profile setup, which runs
              // before the welcome modal and the tour.
              navigate('/profile-setup', { replace: true });
            } else {
              if (result.token) {
                api.setToken(result.token);
                try { localStorage.setItem('nocturne_user', JSON.stringify(result.user)); } catch {} // eslint-disable-line no-empty
                setAppUser(result.user);
              }
              // An account that never finished setup resumes it; returning users
              // go straight to the app. `undefined` is treated as complete so a
              // stale cached user is never locked out.
              const needsSetup = result.user?.profileSetupCompleted === false;
              navigate(needsSetup ? '/profile-setup' : '/home', { replace: true });
            }
        }, 1200);
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.generateOTP(email, isNew ? 'signup' : 'signin', isNew ? null : pendingToken);
      setResent(true);
      setError('');
      setDigits(['', '', '', '', '', '']);
      setTimeLeft(5 * 60 * 1000);
      inputRefs.current[0]?.focus();
      setTimeout(() => setResent(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    }
    setResending(false);
  };

  const formatTime = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

  if (success) {
    return (
      <div className="auth-screen min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0d0d0d]" />
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-green-500/10 blur-[100px]" />
        <div ref={successRef} className="relative z-10 flex flex-col items-center">
          <div className="success-icon w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center mb-5 shadow-[0_0_50px_rgba(34,197,94,0.3)]">
            <span className="material-symbols-outlined text-green-500 text-[40px]">check_circle</span>
          </div>
          <p className="success-text font-headline-lg text-headline-lg text-on-surface">Verified!</p>
          <p className="success-text font-body-sm text-on-surface-variant mt-1">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0d0d0d]" />
      <div ref={orb1} className="absolute top-[-15%] left-[-10%] w-[450px] h-[450px] rounded-full bg-primary/8 blur-[120px]" />
      <div ref={orb2} className="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-purple-500/6 blur-[100px]" />

      {/* Back button */}
      <button onClick={() => navigate(isNew ? '/sign-up' : '/sign-in', { replace: true })}
        className="absolute top-6 left-6 z-20 w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/[0.1] transition-all">
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
      </button>

      {/* Card */}
      <div ref={cardRef} className="relative z-10 w-full max-w-sm fade-up flex flex-col items-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(214,255,61,0.35)]">
          <span className="material-symbols-outlined text-background text-[28px] icon-fill">mail</span>
        </div>

        <h1 className="font-headline-lg text-headline-lg text-on-surface text-center mb-1">Check your email</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant text-center mb-8">
          We sent a 6-digit code to<br />
          <span className="text-on-surface font-medium">{email}</span>
        </p>

        {/* OTP inputs */}
        <div className="flex gap-2.5 mb-4" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              className={`otp-input w-11 h-13 text-center font-headline-md text-headline-md rounded-xl bg-white/[0.04] border-2 transition-all duration-200 focus:outline-none ${
                error ? 'border-red-500/60 text-red-400' : digit ? 'border-primary/60 text-primary bg-primary/5' : 'border-white/[0.08] text-on-surface hover:border-white/20'
              } ${loading ? 'opacity-50' : ''}`}
            />
          ))}
        </div>

        {error && (
        <div role="alert" className="mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-400 text-[16px]" aria-hidden="true">error</span>
            <p className="font-body-xs text-body-xs text-red-400">{error}</p>
          </div>
          {emailIsTaken && (
            <p className="font-body-xs text-body-xs text-on-surface-variant mt-2">
              An account with this email already exists.{' '}
              <button
                type="button"
                onClick={() => navigate('/sign-in', { replace: true, state: { email } })}
                className="text-primary underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                Sign in instead
              </button>.
            </p>
          )}
        </div>
      )}

        {loading && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="font-body-xs text-body-xs text-on-surface-variant">Verifying...</p>
          </div>
        )}

        {/* Timer / Resend */}
        <div className="mt-2 text-center">
          {timeLeft > 0 ? (
            <p className="font-body-xs text-body-xs text-on-surface-variant">
              Resend in <span className="text-primary font-semibold">{formatTime(timeLeft)}</span>
            </p>
          ) : (
            <button onClick={handleResend} disabled={resending}
              className="font-body-xs text-body-xs text-primary font-semibold hover:underline press-feedback">
              {resending ? 'Sending...' : 'Resend code'}
            </button>
          )}
        </div>

        {resent && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-green-400 text-[14px]">check_circle</span>
            <p className="font-body-xs text-body-xs text-green-400">Code sent!</p>
          </div>
        )}
      </div>
    </div>
  );
}
