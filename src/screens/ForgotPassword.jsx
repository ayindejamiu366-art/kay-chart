import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import api from '../services/api';

const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Three-step recovery wizard: email -> emailed code -> new password. The code
// is the same `reset` OTP the server issues for password resets; verifying it
// yields a short-lived token that can only set a new password.
export default function ForgotPassword() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [resending, setResending] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) return;
    setTimeLeft(5 * 60 * 1000);
    const started = Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, 5 * 60 * 1000 - (Date.now() - started));
      setTimeLeft(left);
      if (left <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [email, step]);

  useEffect(() => {
    if (step === 'code') inputRefs.current[0]?.focus();
  }, [step]);

  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSendCode = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!validEmail(trimmed)) { setError(t('FORGOT_ERROR_INVALID_EMAIL')); return; }
    setError('');
    setLoading(true);
    try {
      await api.requestPasswordReset(trimmed);
      setEmail(trimmed);
      setStep('code');
    } catch (err) {
      setError(err.message || t('FORGOT_ERROR_SEND_FAILED'));
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.requestPasswordReset(email);
      setDigits(['', '', '', '', '', '']);
      setError('');
      setTimeLeft(5 * 60 * 1000);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || t('FORGOT_ERROR_SEND_FAILED'));
    }
    setResending(false);
  };

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (next.every(d => d !== '')) handleVerify(next.join(''));
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
    try {
      const result = await api.verifyPasswordResetCode(email, code);
      if (!result.resetToken) throw new Error(t('FORGOT_ERROR_VERIFY_FAILED'));
      setResetToken(result.resetToken);
      setStep('password');
    } catch (err) {
      setError(err.message || t('FORGOT_ERROR_VERIFY_FAILED'));
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
    setLoading(false);
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError(t('FORGOT_ERROR_PASSWORD_MIN')); return; }
    if (password !== confirm) { setError(t('FORGOT_ERROR_PASSWORD_MISMATCH')); return; }
    setError('');
    setLoading(true);
    try {
      await api.confirmPasswordReset(resetToken, password);
      navigate('/sign-in', { replace: true, state: { email, message: t('FORGOT_PASSWORD_UPDATED') } });
    } catch (err) {
      setError(err.message || t('FORGOT_ERROR_RESET_FAILED'));
      setLoading(false);
    }
  };

  const formatTime = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

  const BackButton = () => (
    <button
      onClick={() => (step === 'email' ? navigate('/sign-in') : setStep(step === 'password' ? 'code' : 'email'))}
      className="text-on-surface-variant hover:opacity-80 transition-opacity press-feedback"
    >
      <span className="material-symbols-outlined">arrow_back</span>
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col px-6 py-6 relative overflow-hidden bg-background page-enter">
      <div className="ambient-glow ambient-glow-animated" />
      <header className="flex items-center gap-4 mb-10 fade-up">
        <BackButton />
        <h1 className="font-headline-md text-headline-md text-on-surface">Kay Chart</h1>
      </header>
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        {step === 'email' && (
          <>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-2 fade-up-1">{t('FORGOT_HEADING')}</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 fade-up-2">{t('FORGOT_DESCRIPTION')}</p>
            <form onSubmit={handleSendCode} className="flex flex-col gap-4 fade-up-3">
              <div className="input-glass rounded-full flex items-center px-6 h-14 w-full border-glow">
                <span className="material-symbols-outlined text-tertiary mr-4">mail</span>
                <input
                  className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-body-lg text-body-lg placeholder:text-on-surface-variant/50 p-0"
                  placeholder={t('FORGOT_EMAIL_PLACEHOLDER')}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              {error && (
                <span role="alert" className="flex items-center gap-2 text-error text-sm ml-2">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">error</span>{error}
                </span>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary rounded-full h-14 w-full flex items-center justify-center font-headline-md text-headline-md text-on-primary-container mt-4 glow-pulse disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" /> : t('FORGOT_SEND_CODE')}
              </button>
            </form>
          </>
        )}

        {step === 'code' && (
          <div className="flex flex-col items-center text-center fade-up-1">
            <div className="w-16 h-16 rounded-2xl bg-primary-container/20 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-primary text-[32px] icon-fill">mail</span>
            </div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-2">{t('FORGOT_CHECK_EMAIL')}</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-8">
              {t('FORGOT_CODE_SENT_MSG').replace('{email}', email)}
            </p>

            <div className="flex gap-2.5 mb-4" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  disabled={loading}
                  aria-label={`Digit ${i + 1}`}
                  className={`w-11 h-14 text-center font-headline-md text-headline-md rounded-xl bg-white/[0.04] border-2 transition-all duration-200 focus:outline-none ${
                    error ? 'border-red-500/60 text-red-400' : digit ? 'border-primary/60 text-primary bg-primary/5' : 'border-white/[0.08] text-on-surface hover:border-white/20'
                  } ${loading ? 'opacity-50' : ''}`}
                />
              ))}
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-red-400 text-[16px]" aria-hidden="true">error</span>
                <p className="font-body-xs text-body-xs text-red-400">{error}</p>
              </div>
            )}
            {loading && !error && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="font-body-xs text-body-xs text-on-surface-variant">Verifying...</p>
              </div>
            )}

            <div className="mt-2 text-center">
              {timeLeft > 0 ? (
                <p className="font-body-xs text-body-xs text-on-surface-variant">
                  Resend in <span className="text-primary font-semibold">{formatTime(timeLeft)}</span>
                </p>
              ) : (
                <button onClick={handleResend} disabled={resending} className="font-body-xs text-body-xs text-primary font-semibold hover:underline press-feedback">
                  {resending ? 'Sending...' : t('FORGOT_RESEND_OTP')}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'password' && (
          <>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-2 fade-up-1">{t('FORGOT_NEW_PASSWORD_HEADING')}</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 fade-up-2">{t('FORGOT_NEW_PASSWORD_DESCRIPTION')}</p>
            <form onSubmit={handleConfirm} className="flex flex-col gap-4 fade-up-3">
              <div className="input-glass rounded-full flex items-center px-6 h-14 w-full border-glow">
                <span className="material-symbols-outlined text-tertiary mr-4">lock</span>
                <input
                  className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-body-lg text-body-lg placeholder:text-on-surface-variant/50 p-0"
                  placeholder={t('FORGOT_NEW_PASSWORD_PLACEHOLDER')}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
              <div className="input-glass rounded-full flex items-center px-6 h-14 w-full border-glow">
                <span className="material-symbols-outlined text-tertiary mr-4">lock_reset</span>
                <input
                  className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-body-lg text-body-lg placeholder:text-on-surface-variant/50 p-0"
                  placeholder={t('FORGOT_CONFIRM_PASSWORD_PLACEHOLDER')}
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
              {error && (
                <span role="alert" className="flex items-center gap-2 text-error text-sm ml-2">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">error</span>{error}
                </span>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary rounded-full h-14 w-full flex items-center justify-center font-headline-md text-headline-md text-on-primary-container mt-4 glow-pulse disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" /> : t('FORGOT_RESET_PASSWORD')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
