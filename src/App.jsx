import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './hooks/useApp';
import { useOnlineStatus } from './hooks/useAudio';
import { usePWA } from './hooks/usePWA';
import { useEffect, Suspense, lazy, useRef } from 'react';
import MiniPlayer from './components/MiniPlayer';
import BottomNav from './components/BottomNav';
import AppSidebar from './components/AppSidebar';
import YouTubePlayerOverlay from './components/YouTubePlayer';
import ErrorBoundary from './components/ErrorBoundary';
import OnboardingProvider from './components/onboarding/OnboardingProvider';
import { gsap, prefersReduced, initGSAP, pageEnter } from './utils/gsap';
import { useGSAP } from '@gsap/react';
import { NEEDS_API_BASE } from './config';
import ConnectServer from './screens/ConnectServer';
import CelebrationProvider, { useCelebration } from './context/CelebrationContext';
import CelebrationEffects from './components/celebrations/CelebrationEffects';
import PWAUpdateNotifier from './components/PWAUpdateNotifier';
import PWAInstallPrompt from './components/PWAInstallPrompt';

initGSAP();

const SplashScreen = lazy(() => import('./screens/SplashScreen'));
const OnboardingWelcome = lazy(() => import('./screens/OnboardingWelcome'));
const SignUp = lazy(() => import('./screens/SignUp'));
const SignIn = lazy(() => import('./screens/SignIn'));
const ForgotPassword = lazy(() => import('./screens/ForgotPassword'));
const Home = lazy(() => import('./screens/Home'));
const SearchResults = lazy(() => import('./screens/SearchResults'));
const ExploreGenres = lazy(() => import('./screens/ExploreGenres'));
const ArtistProfile = lazy(() => import('./screens/ArtistProfile'));
const AlbumDetail = lazy(() => import('./screens/AlbumDetail'));
const NowPlaying = lazy(() => import('./screens/NowPlaying'));
const PlayingQueue = lazy(() => import('./screens/PlayingQueue'));
const SyncedLyrics = lazy(() => import('./screens/SyncedLyrics'));
const AIDJ = lazy(() => import('./screens/AIDJ'));
const AIPlayer = lazy(() => import('./screens/AIPlayer'));
const YourLibrary = lazy(() => import('./screens/YourLibrary'));
const CreatePlaylist = lazy(() => import('./screens/CreatePlaylist'));
const AddSongsToPlaylist = lazy(() => import('./screens/AddSongsToPlaylist'));
const LikedSongs = lazy(() => import('./screens/LikedSongs'));
const Downloads = lazy(() => import('./screens/Downloads'));
const UserProfile = lazy(() => import('./screens/UserProfile'));
const EditProfile = lazy(() => import('./screens/EditProfile'));
const Notifications = lazy(() => import('./screens/Notifications'));
const ArtistUpload = lazy(() => import('./screens/ArtistUpload'));
const AdminPanel = lazy(() => import('./screens/AdminPanel'));
const OTPVerify = lazy(() => import('./screens/OTPVerify'));
  const ProfileSetup = lazy(() => import('./screens/ProfileSetup'));
  const GenreSelection = lazy(() => import('./screens/GenreSelection'));
const ArtistSelection = lazy(() => import('./screens/ArtistSelection'));
const LanguagePicker = lazy(() => import('./screens/LanguagePicker'));
const Support = lazy(() => import('./screens/Support'));
const ActivityFeed = lazy(() => import('./screens/ActivityFeed'));
const Analytics = lazy(() => import('./screens/Analytics'));
const SpotifySettings = lazy(() => import('./screens/SpotifySettings'));
const PremiumUpgrade = lazy(() => import('./screens/PremiumUpgrade'));
const ChooseYourSound = lazy(() => import('./screens/ChooseYourSound'));
const SmartTidyUp = lazy(() => import('./screens/SmartTidyUp'));
const YouAreOffline = lazy(() => import('./screens/YouAreOffline'));
const Charts = lazy(() => import('./screens/Charts'));

function ProtectedRoute({ children, adminOnly }) {
  const { user, loading, authChecked } = useApp();
  const { pathname } = useLocation();
  const authPending = loading || !authChecked;
  if (authPending) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 animate-breathe">
          <span className="material-symbols-outlined text-background text-[28px] icon-fill">music_note</span>
        </div>
        <p className="font-body-sm text-on-surface-variant">Loading...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/sign-in" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/home" replace />;
  // A new account must finish profile setup before it can use the app. Only an
  // explicit `false` gates the route: `undefined` means the field has not loaded
  // yet or predates the wizard, and redirecting on that would lock out every
  // existing user.
  if (user.profileSetupCompleted === false && pathname !== '/profile-setup') {
    return <Navigate to="/profile-setup" replace />;
  }
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function PageTransition({ children }) {
  const { pathname } = useLocation();
  const containerRef = useRef(null);

  useGSAP(() => {
    if (!containerRef.current || prefersReduced) return;

    gsap.fromTo(containerRef.current,
      { opacity: 0, y: 12 },
      {
        opacity: 1,
        y: 0,
        duration: 0.35,
        ease: 'power2.out',
        overwrite: 'auto',
        // Drop the transform once it is identity. While set, this wrapper is
        // the containing block for any `position: fixed` descendant and it
        // breaks `position: sticky` headers inside routed screens.
        onComplete: () => gsap.set(containerRef.current, { clearProps: 'transform' }),
      }
    );
  }, { scope: containerRef, dependencies: [pathname] });

  return <div ref={containerRef} key={pathname}>{children}</div>;
}

function AuthenticatedLayout({ children }) {
  const { pathname } = useLocation();
  const { audio, videoTrack, youtubeQueue, playYouTubeNext, playYouTubePrev, closeVideo } = useApp();
  const isOnline = useOnlineStatus();
  // Home ships its own full-height chrome (sidebar + Now Playing + in-flow
  // player), so it opts out of the shared shell. Every other authenticated
  // screen gets the same sidebar on desktop; below `lg` the bottom bar takes
  // over, so the two never appear at once.
  const isHome = pathname === '/home';
  if (!isOnline) {
    return (
    <div className="min-h-screen pb-[160px]">
        <YouAreOffline />
      </div>
    );
  }
  return (
    <div className={isHome ? 'h-screen overflow-hidden' : 'flex min-h-screen'}>
      {!isHome && <AppSidebar />}
      <div className={isHome ? 'contents' : 'flex-1 min-w-0 pb-[168px] lg:pb-24'}>
        <PageTransition>{children}</PageTransition>
      </div>
      {/* Video only renders while the user is actually watching. The transport
          controls stay in the shared MiniPlayer, so there is one music bar
          whether the engine is audio or YouTube. Closing the video leaves
          playback available in the MiniPlayer rather than ending it. */}
      {videoTrack && <YouTubePlayerOverlay track={videoTrack} queue={youtubeQueue} onNext={playYouTubeNext} onPrev={playYouTubePrev} onClose={closeVideo} />}
      {!isHome && audio.currentTrack && <MiniPlayer />}
      <BottomNav />
    </div>
  );
}

function AppRoutes() {
  const { user } = useApp();
  return (
    <ErrorBoundary>
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 animate-breathe">
          <span className="material-symbols-outlined text-primary text-[24px] icon-fill">music_note</span>
        </div>
      </div>
    }>
    <Routes>
      <Route path="/splash" element={<SplashScreen />} />
      <Route path="/" element={<SplashScreen />} />
      <Route path="/welcome" element={<OnboardingWelcome />} />
      <Route path="/sign-up" element={<SignUp />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/verify-otp" element={<OTPVerify />} />
      <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
      {/* Kept registered so older bookmarks and in-app links do not 404, but the
          new-user path no longer routes here — ProfileSetup owns the whole flow. */}
      <Route path="/select-genres" element={<ProtectedRoute><PageTransition><GenreSelection /></PageTransition></ProtectedRoute>} />
      <Route path="/select-artists" element={<ProtectedRoute><PageTransition><ArtistSelection /></PageTransition></ProtectedRoute>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/home" element={<ProtectedRoute><AuthenticatedLayout><Home /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><AuthenticatedLayout><SearchResults /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/search/:query" element={<ProtectedRoute><AuthenticatedLayout><SearchResults /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/explore" element={<ProtectedRoute><AuthenticatedLayout><ExploreGenres /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/artist/:id" element={<ProtectedRoute><AuthenticatedLayout><ArtistProfile /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/album/:id" element={<ProtectedRoute><AuthenticatedLayout><AlbumDetail /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/now-playing" element={<ProtectedRoute><PageTransition><NowPlaying /></PageTransition></ProtectedRoute>} />
      <Route path="/queue" element={<ProtectedRoute><PageTransition><PlayingQueue /></PageTransition></ProtectedRoute>} />
      <Route path="/lyrics" element={<ProtectedRoute><PageTransition><SyncedLyrics /></PageTransition></ProtectedRoute>} />
      <Route path="/ai-dj" element={<ProtectedRoute><AuthenticatedLayout><AIDJ /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/ai-player" element={<ProtectedRoute><PageTransition><AIPlayer /></PageTransition></ProtectedRoute>} />
      <Route path="/library" element={<ProtectedRoute><AuthenticatedLayout><YourLibrary /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/create-playlist" element={<ProtectedRoute><PageTransition><CreatePlaylist /></PageTransition></ProtectedRoute>} />
      <Route path="/add-songs/:playlistId" element={<ProtectedRoute><PageTransition><AddSongsToPlaylist /></PageTransition></ProtectedRoute>} />
      <Route path="/liked-songs" element={<ProtectedRoute><AuthenticatedLayout><LikedSongs /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/downloads" element={<ProtectedRoute><AuthenticatedLayout><Downloads /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AuthenticatedLayout><UserProfile /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/edit-profile" element={<ProtectedRoute><PageTransition><EditProfile /></PageTransition></ProtectedRoute>} />
      <Route path="/language" element={<ProtectedRoute><PageTransition><LanguagePicker /></PageTransition></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><PageTransition><Support /></PageTransition></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute><PageTransition><ActivityFeed /></PageTransition></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute adminOnly><PageTransition><Analytics /></PageTransition></ProtectedRoute>} />
      <Route path="/spotify" element={<ProtectedRoute><PageTransition><SpotifySettings /></PageTransition></ProtectedRoute>} />
      <Route path="/premium" element={<ProtectedRoute><PageTransition><PremiumUpgrade /></PageTransition></ProtectedRoute>} />
      <Route path="/edit-genres" element={<ProtectedRoute><PageTransition><ChooseYourSound /></PageTransition></ProtectedRoute>} />
      <Route path="/tidy-up" element={<ProtectedRoute><PageTransition><SmartTidyUp /></PageTransition></ProtectedRoute>} />
      <Route path="/charts" element={<ProtectedRoute><AuthenticatedLayout><Charts /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><AuthenticatedLayout><Notifications /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/upload" element={<ProtectedRoute><AuthenticatedLayout><ArtistUpload /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><AuthenticatedLayout><AdminPanel /></AuthenticatedLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? "/home" : "/splash"} replace />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Renders the ambient celebration layer once for the whole application.
 *
 * Sitting here rather than in Home means the atmosphere carries across every
 * screen, and there is exactly one instance instead of a copy per page. It is
 * pointer-events-none and sits behind content, so it cannot block playback,
 * navigation or album artwork.
 */
function CelebrationLayer() {
  const { isCelebrationActive, theme } = useCelebration();
  if (!isCelebrationActive) return null;
  return <CelebrationEffects theme={theme} active />;
}

export default function App() {
  const { updateAvailable, applyUpdate, installPrompt, dismissInstallPrompt, isIOS, isStandalone } = usePWA();

  return (
    <BrowserRouter>
      <AppProvider>
        {/* Sits above the routed screens so onboarding is never unmounted by a
            navigation, and outside PageTransition's transformed wrapper so the
            fixed spotlight cannot be captured by a containing block. */}
        <OnboardingProvider>
          <CelebrationProvider>
            <div className="min-h-screen overflow-x-hidden bg-background text-on-surface font-body-lg">
              <ScrollToTop />
              <CelebrationLayer />
              {/* A native build with no reachable server address cannot load
                  anything, so ask for one up front instead of rendering a shell
                  whose every request fails. */}
              {NEEDS_API_BASE ? <ConnectServer /> : <AppRoutes />}
              <PWAUpdateNotifier updateAvailable={updateAvailable} applyUpdate={applyUpdate} />
              <PWAInstallPrompt
                installPrompt={installPrompt}
                dismissInstallPrompt={dismissInstallPrompt}
                isIOS={isIOS}
                isStandalone={isStandalone}
              />
            </div>
          </CelebrationProvider>
        </OnboardingProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
