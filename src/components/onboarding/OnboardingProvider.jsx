import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import api from '../../services/api';
import { WELCOME_DELAY_MS, isOnboardingRoute, onboardingStorageKey } from './onboardingConfig';
import WelcomeModal from './WelcomeModal';
import OnboardingTour from './OnboardingTour';

const OnboardingContext = createContext(null);

const readLocalFlag = (userId) => {
  if (!userId) return null;
  try {
    return localStorage.getItem(onboardingStorageKey(userId)) === 'done';
  } catch {
    return null;
  }
};

const writeLocalFlag = (userId) => {
  if (!userId) return;
  try {
    localStorage.setItem(onboardingStorageKey(userId), 'done');
  } catch {
    /* localStorage unavailable (private mode) — server copy still holds */
  }
};

/**
 * Owns first-time onboarding state.
 *
 * The server is the source of truth (`user_preferences.onboarding_completed`),
 * so completion follows the user across browsers and devices. localStorage is a
 * per-user mirror used to avoid showing anything before that data arrives, and
 * to keep the tour suppressed if the network write fails.
 *
 * Eligibility is decided server-side: accounts created before onboarding shipped
 * are never eligible, so existing users are not shown a tour they never saw.
 */
export function OnboardingProvider({ children }) {
  const { user, audio } = useApp();
  const { pathname } = useLocation();

  const [phase, setPhase] = useState('idle'); // idle | welcome | tour
  const [stepIndex, setStepIndex] = useState(0);
  const [localDone, setLocalDone] = useState(false);
  const timerRef = useRef(null);
  const startedForRef = useRef(null);

  const userId = user?.id || null;
  const isEligible = user?.onboardingEligible === true;
  const isCompleted = user?.onboardingCompleted === true || localDone;
  const onAppRoute = isOnboardingRoute(pathname);

  // Profile setup is a separate, earlier stage. The welcome modal and tour only
  // run once the account is actually set up, so a brand new user sees the wizard
  // first and is not interrupted by a spotlight over a half-built profile.
  // `undefined` means the field has not arrived yet (or predates the wizard), so
  // treat it as "do not block" rather than trapping the user.
  const profileSetupComplete = user?.profileSetupCompleted !== false;

  // Re-read the mirror whenever the account changes so one user's dismissal can
  // never suppress — or inherit — another user's onboarding.
  useEffect(() => {
    setLocalDone(readLocalFlag(userId) === true);
  }, [userId]);

  // Persist completion to the server and to the per-user mirror.
  const persistCompleted = useCallback(async () => {
    setLocalDone(true);
    writeLocalFlag(userId);
    try {
      await api.setOnboardingCompleted(true);
    } catch {
      // Non-fatal: the local mirror still suppresses the tour on this device,
      // and the server copy catches up on the next explicit save.
    }
  }, [userId]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPhase('idle');
    setStepIndex(0);
    startedForRef.current = null;
  }, []);

  const close = useCallback(() => {
    persistCompleted();
    reset();
  }, [persistCompleted, reset]);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setPhase('tour');
  }, []);

  // "Maybe later" — counts as seen so the user is not nagged again on this or any
  // other device. Profile keeps an explicit "Take a tour" for anyone who wants it.
  const dismiss = useCallback(() => close(), [close]);

  const replay = useCallback(() => {
    setStepIndex(0);
    setPhase('tour');
  }, []);

  // Auto-start for eligible, not-yet-onboarded users, once per user id.
  useEffect(() => {
    if (!userId || !isEligible || isCompleted || !onAppRoute) return;
    if (!profileSetupComplete) return;
    if (startedForRef.current === userId) return;

    startedForRef.current = userId;
    timerRef.current = setTimeout(() => setPhase('welcome'), WELCOME_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [userId, isEligible, isCompleted, onAppRoute, profileSetupComplete]);

  // Stand down if the user is sent back into setup (e.g. profile data is reset
  // server-side) so the tour cannot hang over the wizard.
  useEffect(() => {
    if (phase !== 'idle' && !profileSetupComplete) reset();
  }, [profileSetupComplete, phase, reset]);

  // Reset when the account changes so one user never inherits another's state.
  useEffect(() => {
    if (startedForRef.current && startedForRef.current !== userId) reset();
  }, [userId, reset]);

  // Never trap the user: if they navigate away mid-tour, stand down quietly.
  useEffect(() => {
    if (phase !== 'idle' && !onAppRoute) reset();
  }, [onAppRoute, phase, reset]);

  const value = useMemo(() => ({
    phase,
    stepIndex,
    startTour,
    dismiss,
    close,
    replay,
    isEligible,
    isCompleted,
    setStepIndex,
    hasPlayer: !!audio?.currentTrack,
  }), [phase, stepIndex, startTour, dismiss, close, replay, isEligible, isCompleted, audio?.currentTrack]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {phase === 'welcome' && (
        <WelcomeModal onStartTour={startTour} onDismiss={dismiss} user={user} />
      )}
      {phase === 'tour' && (
        <OnboardingTour
          user={user}
          stepIndex={stepIndex}
          setStepIndex={setStepIndex}
          onFinish={close}
          onSkip={close}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext) || {};
}

export default OnboardingProvider;
