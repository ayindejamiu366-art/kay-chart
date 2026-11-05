import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import api from '../services/api';
import { COUNTRY_MUSIC, getCountryName } from '../utils/country';
import { Skeleton, SkeletonText, SkeletonCircle } from '../components/skeleton';

const STEPS = ['profile', 'genres', 'artists', 'personalization', 'summary'];

const STEP_COPY = {
  profile: {
    icon: 'person',
    title: 'Create your profile',
    subtitle: 'Pick a name and a photo. Your photo is optional — you can add one later in Profile.',
  },
  genres: {
    icon: 'tune',
    title: 'What do you listen to?',
    subtitle: 'Choose a few genres so Kay Chart can shape your Home feed.',
  },
  artists: {
    icon: 'mic_external_on',
    title: 'Any artists you love?',
    subtitle: 'Pick artists you already listen to, or search for more.',
  },
  personalization: {
    icon: 'public',
    title: 'Where do you listen?',
    subtitle: 'Your country helps us surface music from where you are.',
  },
  summary: {
    icon: 'check_circle',
    title: 'You are all set',
    subtitle: 'Check everything over, then head into Kay Chart.',
  },
};

const USERNAME_RULES = '3-20 characters. Letters, numbers and underscores only.';
const MAX_GENRES = 12;
const MAX_ARTISTS = 20;

const isValidUsernameFormat = (value) => /^[A-Za-z0-9_]{3,20}$/.test(value);

const countryOptions = Object.keys(COUNTRY_MUSIC)
  .map(code => ({ code, name: getCountryName(code) || code }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user, refreshUser } = useApp();

  const [step, setStep] = useState(() => {
    const saved = user?.profileSetupStep;
    return STEPS.includes(saved) ? saved : 'profile';
  });
  const [username, setUsername] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [genres, setGenres] = useState(user?.genres || []);
  const [selectedArtists, setSelectedArtists] = useState(user?.selectedArtists || []);
  const [country, setCountry] = useState(user?.country || '');

  const [availableGenres, setAvailableGenres] = useState([]);
  const [catalogueArtists, setCatalogueArtists] = useState([]);
  // Separate from `catalogueArtists.length` so a genuinely empty catalogue is
  // not mistaken for a request still in flight.
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [artistQuery, setArtistQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [availability, setAvailability] = useState({ state: 'idle', message: '' });
  const [status, setStatus] = useState({ tone: 'idle', message: '' });
  const [saving, setSaving] = useState(false);
  const [booting, setBooting] = useState(true);

  const headingRef = useRef(null);
  const fileInputRef = useRef(null);
  const fileNameRef = useRef(null);
  const availabilityTimer = useRef(null);
  const searchTimer = useRef(null);
  const latestRequest = useRef(0);

  const stepIndex = STEPS.indexOf(step);
  const firstName = String(user?.name || '').trim().split(/\s+/)[0] || '';

  // Resume from the server so a refresh mid-wizard lands on the right step.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [setup, genreRes, artistRes] = await Promise.allSettled([
          api.getProfileSetup(),
          api.getSetupGenres(),
          api.getSetupArtists(),
        ]);
        if (cancelled) return;

        if (setup.status === 'fulfilled') {
          const state = setup.value;
          // Already finished: never re-run the wizard.
          if (state.profileSetupCompleted) {
            navigate('/home', { replace: true });
            return;
          }
          if (state.username) setUsername(state.username);
          if (state.avatar) setAvatar(state.avatar);
          if (Array.isArray(state.genres) && state.genres.length) setGenres(state.genres);
          if (Array.isArray(state.selectedArtists) && state.selectedArtists.length) setSelectedArtists(state.selectedArtists);
          if (state.country) setCountry(state.country);
          if (STEPS.includes(state.profileSetupStep)) setStep(state.profileSetupStep);
        }
        if (genreRes.status === 'fulfilled' && genreRes.value?.genres) {
          setAvailableGenres(genreRes.value.genres);
        }
        if (artistRes.status === 'fulfilled' && artistRes.value?.artists) {
          setCatalogueArtists(artistRes.value.artists);
        }
      } catch { /* the wizard still works from cached user state */ }
      finally {
        if (!cancelled) {
          setCatalogueLoading(false);
          setBooting(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Debounced availability check against the real endpoint.
  const runAvailabilityCheck = useCallback((value) => {
    if (availabilityTimer.current) clearTimeout(availabilityTimer.current);
    const candidate = value.trim();
    if (!candidate) {
      setAvailability({ state: 'idle', message: '' });
      return;
    }
    if (!isValidUsernameFormat(candidate)) {
      setAvailability({ state: 'invalid', message: USERNAME_RULES });
      return;
    }
    setAvailability({ state: 'checking', message: 'Checking availability...' });
    availabilityTimer.current = setTimeout(async () => {
      const result = await api.checkUsername(candidate);
      if (result.reason === 'taken') {
        setAvailability({ state: 'taken', message: 'That username is already taken' });
      } else if (result.reason === 'invalid') {
        setAvailability({ state: 'invalid', message: result.error || USERNAME_RULES });
      } else if (result.reason === 'error') {
        setAvailability({ state: 'error', message: 'Could not check that username. Try again.' });
      } else {
        setAvailability({ state: 'available', message: `${candidate} is available` });
      }
    }, 400);
  }, []);

  const handleUsernameChange = (event) => {
    const value = event.target.value.replace(/\s/g, '');
    setUsername(value);
    runAvailabilityCheck(value);
  };

  // Debounced live artist search against the existing music search endpoint.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const query = artistQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const requestId = latestRequest.current + 1;
      latestRequest.current = requestId;
      try {
        const result = await api.get(`/music/search/artists?q=${encodeURIComponent(query)}&limit=12`);
        if (latestRequest.current !== requestId) return;
        const found = result.artists || result.data || [];
        setSearchResults(Array.isArray(found) ? found : []);
      } catch {
        if (latestRequest.current === requestId) setSearchResults([]);
      } finally {
        if (latestRequest.current === requestId) setSearching(false);
      }
    }, 400);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [artistQuery]);

  // Move focus to the step heading so keyboard and screen-reader users follow
  // the wizard instead of staying parked on the previous step's button.
  useEffect(() => {
    if (booting) return;
    if (fileNameRef.current) return;
    headingRef.current?.focus();
  }, [step, booting]);

  useEffect(() => () => {
    if (availabilityTimer.current) clearTimeout(availabilityTimer.current);
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const showStatus = (tone, message) => setStatus({ tone, message });

  const persist = useCallback(async (patch) => {
    try {
      const state = await api.saveProfileSetup(patch);
      if (state.genres) setGenres(state.genres);
      if (state.selectedArtists) setSelectedArtists(state.selectedArtists);
      if (state.country) setCountry(state.country);
      return state;
    } catch (err) {
      throw err;
    }
  }, []);

  const goTo = async (nextStep, patch = {}) => {
    setSaving(true);
    showStatus('idle', '');
    try {
      await persist({ ...patch, step: nextStep });
      setStep(nextStep);
      showStatus('idle', '');
    } catch (err) {
      showStatus('error', err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSaving(true);
    showStatus('idle', '');
    try {
      const result = await api.uploadProfileAvatar(file);
      setAvatar(result.avatar);
      showStatus('success', 'Profile photo updated.');
    } catch (err) {
      showStatus('error', err.message || 'Could not upload that photo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setSaving(true);
    try {
      const result = await api.removeProfileAvatar();
      setAvatar(result.avatar);
      showStatus('success', 'Profile photo removed.');
    } catch (err) {
      showStatus('error', err.message || 'Could not remove that photo.');
    } finally {
      setSaving(false);
    }
  };

  const toggleGenre = (name) => {
    setGenres(prev => {
      if (prev.includes(name)) return prev.filter(g => g !== name);
      if (prev.length >= MAX_GENRES) {
        showStatus('error', `You can pick up to ${MAX_GENRES} genres.`);
        return prev;
      }
      return [...prev, name];
    });
  };

  const toggleArtist = (name) => {
    setSelectedArtists(prev => {
      if (prev.includes(name)) return prev.filter(a => a !== name);
      if (prev.length >= MAX_ARTISTS) {
        showStatus('error', `You can pick up to ${MAX_ARTISTS} artists.`);
        return prev;
      }
      return [...prev, name];
    });
  };

  const handleProfileNext = async () => {
    const candidate = username.trim();
    if (!candidate) {
      showStatus('error', 'Choose a username to continue.');
      return;
    }
    if (!isValidUsernameFormat(candidate)) {
      showStatus('error', USERNAME_RULES);
      return;
    }
    if (availability.state === 'checking') {
      showStatus('error', 'Still checking that username — one moment.');
      return;
    }
    if (availability.state === 'taken') {
      showStatus('error', 'That username is already taken.');
      return;
    }
    if (availability.state === 'error') {
      showStatus('error', 'Could not check that username. Try again.');
      return;
    }
    await goTo('genres', { username: candidate });
  };

  const handleComplete = async () => {
    setSaving(true);
    showStatus('idle', '');
    try {
      await api.completeProfileSetup();
      // Refresh so every consumer of `user` sees the username and the completed
      // flag, which is what releases the app-route gate.
      await refreshUser();
      navigate('/home', { replace: true });
    } catch (err) {
      showStatus('error', err.message || 'Could not finish setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canContinue = useMemo(() => {
    if (step === 'profile') return isValidUsernameFormat(username.trim()) && availability.state !== 'taken' && availability.state !== 'checking';
    if (step === 'genres') return genres.length > 0;
    if (step === 'artists') return selectedArtists.length > 0;
    if (step === 'personalization') return !!country;
    return true;
  }, [step, username, availability.state, genres.length, selectedArtists.length, country]);

  const goBack = () => {
    const index = Math.max(0, stepIndex - 1);
    setStep(STEPS[index]);
    showStatus('idle', '');
  };

  const artistNameFor = (id) => {
    const match = catalogueArtists.find(a => a.id === id);
    if (match) return match.name;
    return id;
  };

  if (booting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 animate-breathe">
          <span className="material-symbols-outlined text-primary text-[26px] icon-fill">person</span>
        </div>
        <p className="font-body-sm text-on-surface-variant">Preparing your profile...</p>
      </div>
    );
  }

  const copy = STEP_COPY[step];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress header */}
      <header className="px-5 pt-6 pb-4 sm:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="font-body-xs text-on-surface-variant">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            <span className="font-body-xs text-primary">{Math.round(((stepIndex + 1) / STEPS.length) * 100)}%</span>
          </div>
          <div
            className="h-1.5 w-full rounded-full bg-surface-variant overflow-hidden"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={stepIndex + 1}
            aria-label="Profile setup progress"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pb-8 sm:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-[28px] mt-0.5" aria-hidden="true">{copy.icon}</span>
            <div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="font-display-sm text-on-surface outline-none"
              >
                {firstName ? `${copy.title.replace('Create your', 'Finish your')}` : copy.title}
              </h1>
              <p className="font-body-sm text-on-surface-variant mt-1">{copy.subtitle}</p>
            </div>
          </div>

          {status.message && (
            <div
              role={status.tone === 'error' ? 'alert' : 'status'}
              className={`mb-4 rounded-xl px-4 py-3 font-body-sm border ${
                status.tone === 'error'
                  ? 'bg-error/10 border-error/40 text-error'
                  : status.tone === 'success'
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-surface-variant/40 border-surface-variant text-on-surface-variant'
              }`}
            >
              {status.message}
            </div>
          )}

          {/* STEP 1 — profile */}
          {step === 'profile' && (
            <section className="space-y-6">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full overflow-hidden bg-surface-variant flex items-center justify-center border border-surface-variant">
                    {avatar ? (
                      <img src={avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-on-surface-variant text-[40px]" aria-hidden="true">
                        {firstName ? firstName.charAt(0).toUpperCase() : 'person'}
                      </span>
                    )}
                  </div>
                  {saving && (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <span className="material-symbols-outlined text-primary animate-spin" aria-hidden="true">progress_activity</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-2 font-body-sm text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add_a_photo</span>
                    {avatar ? 'Change photo' : 'Add a photo'}
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 font-body-sm text-on-surface-variant hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleAvatarSelected}
                  className="sr-only"
                  aria-label="Choose a profile photo"
                />
                <p className="font-body-xs text-on-surface-variant text-center max-w-sm">
                  PNG, JPEG, GIF or WebP. Up to 5MB, at least 64x64.
                </p>
              </div>

              <div>
                <label htmlFor="setup-username" className="block font-body-sm text-on-surface mb-2">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body-sm text-on-surface-variant" aria-hidden="true">@</span>
                  <input
                    id="setup-username"
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    autoComplete="username"
                    spellCheck={false}
                    maxLength={20}
                    placeholder="yourname"
                    aria-describedby="username-help username-status"
                    aria-invalid={availability.state === 'taken' || availability.state === 'invalid'}
                    className="w-full rounded-xl bg-surface-variant/40 border border-surface-variant pl-8 pr-10 py-3 font-body text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
                  />
                  {availability.state === 'checking' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[18px] animate-spin" aria-hidden="true">progress_activity</span>
                  )}
                  {availability.state === 'available' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary text-[18px]" aria-hidden="true">check_circle</span>
                  )}
                  {availability.state === 'taken' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-error text-[18px]" aria-hidden="true">error</span>
                  )}
                </div>
                <p id="username-help" className="font-body-xs text-on-surface-variant mt-1.5">{USERNAME_RULES}</p>
                <p
                  id="username-status"
                  role="status"
                  aria-live="polite"
                  className={`font-body-xs mt-1 min-h-[1rem] ${
                    availability.state === 'available' ? 'text-primary'
                      : availability.state === 'taken' || availability.state === 'invalid' || availability.state === 'error' ? 'text-error'
                        : 'text-transparent'
                  }`}
                >
                  {availability.message || 'placeholder'}
                </p>
              </div>
            </section>
          )}

          {/* STEP 2 — genres */}
          {step === 'genres' && (
            <section>
              <p className="font-body-xs text-on-surface-variant mb-3">
                {genres.length} of {MAX_GENRES} selected
              </p>
              {availableGenres.length === 0 ? (
                /* The chip grid is the real layout, so reserve it while the
                   catalogue request is in flight rather than showing a line of
                   text and reflowing when it lands. */
                <div className="flex flex-wrap gap-2" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} width={92 + ((i * 13) % 46)} height={38} radius="9999px" animation="pulse" />
                  ))}
                </div>
              ) : (
                <ul className="flex flex-wrap gap-2" role="group" aria-label="Genres">
                  {availableGenres.map(genre => {
                    const selected = genres.includes(genre.name);
                    return (
                      <li key={genre.id}>
                        <button
                          type="button"
                          onClick={() => toggleGenre(genre.name)}
                          aria-pressed={selected}
                          className={`rounded-full border px-4 py-2.5 font-body-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                            selected
                              ? 'bg-primary text-background border-primary'
                              : 'bg-surface-variant/40 text-on-surface border-surface-variant hover:border-primary/60'
                          }`}
                        >
                          {genre.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* STEP 3 — artists */}
          {step === 'artists' && (
            <section className="space-y-5">
              <p className="font-body-xs text-on-surface-variant">
                {selectedArtists.length} of {MAX_ARTISTS} selected
              </p>

              <div>
                <label htmlFor="artist-search" className="sr-only">Search for artists</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[20px]" aria-hidden="true">search</span>
                  <input
                    id="artist-search"
                    type="search"
                    value={artistQuery}
                    onChange={(e) => setArtistQuery(e.target.value)}
                    placeholder="Search for an artist"
                    autoComplete="off"
                    className="w-full rounded-xl bg-surface-variant/40 border border-surface-variant pl-10 pr-4 py-3 font-body text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
                  />
                </div>
              </div>

              {selectedArtists.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Selected artists">
                  {selectedArtists.map(name => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => toggleArtist(name)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/50 px-3 py-1.5 font-body-sm text-primary hover:bg-primary/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
                      >
                        {name}
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
                        <span className="sr-only">Remove {name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {artistQuery.trim().length >= 2 && (
                <div>
                  <h2 className="font-body-sm text-on-surface mb-2">
                    {searching ? 'Searching...' : searchResults.length ? 'Search results' : 'No matches'}
                  </h2>
                  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {searchResults.map(artist => {
                      const selected = selectedArtists.includes(artist.name);
                      return (
                        <li key={artist.id}>
                          <button
                            type="button"
                            onClick={() => toggleArtist(artist.name)}
                            aria-pressed={selected}
                            className={`w-full flex items-center gap-2 rounded-xl border p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              selected ? 'border-primary bg-primary/10' : 'border-surface-variant bg-surface-variant/30 hover:border-primary/60'
                            }`}
                          >
                            {artist.photo ? (
                              <img src={artist.photo} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" loading="lazy" />
                            ) : (
                              <span className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-on-surface-variant text-[18px]" aria-hidden="true">person</span>
                              </span>
                            )}
                            <span className="font-body-xs text-on-surface truncate">{artist.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {artistQuery.trim().length < 2 && (
                <div>
                  <h2 className="font-body-sm text-on-surface mb-2">In Kay Chart</h2>
                  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* The real provider catalogue, not a sample: these tiles
                        mirror the actual artist tiles that render below. */}
                    {catalogueLoading
                      ? Array.from({ length: 6 }, (_, i) => (
                        <li key={`sk-${i}`} aria-hidden="true">
                          <div className="w-full flex items-center gap-2 rounded-xl border border-surface-variant bg-surface-variant/30 p-2">
                            <SkeletonCircle size={40} animation="pulse" />
                            <SkeletonText width="58%" height={12} animation="pulse" />
                          </div>
                        </li>
                      ))
                      : catalogueArtists.map(artist => {
                      const selected = selectedArtists.includes(artist.name);
                      return (
                        <li key={artist.id}>
                          <button
                            type="button"
                            onClick={() => toggleArtist(artist.name)}
                            aria-pressed={selected}
                            className={`w-full flex items-center gap-2 rounded-xl border p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              selected ? 'border-primary bg-primary/10' : 'border-surface-variant bg-surface-variant/30 hover:border-primary/60'
                            }`}
                          >
                            {artist.photo ? (
                              <img src={artist.photo} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 bg-surface-variant" loading="lazy" />
                            ) : (
                              <span className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-on-surface-variant text-[18px]" aria-hidden="true">person</span>
                              </span>
                            )}
                            <span className="font-body-xs text-on-surface truncate">{artist.name}</span>
                          </button>
                        </li>
                      );
                      })}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* STEP 4 — personalization */}
          {step === 'personalization' && (
            <section>
              <label htmlFor="country-select" className="block font-body-sm text-on-surface mb-2">
                Country
              </label>
              <select
                id="country-select"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-xl bg-surface-variant/40 border border-surface-variant px-4 py-3 font-body text-on-surface focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
              >
                <option value="">Select your country</option>
                {countryOptions.map(option => (
                  <option key={option.code} value={option.code}>{option.name}</option>
                ))}
              </select>
            </section>
          )}

          {/* STEP 5 — summary */}
          {step === 'summary' && (
            <section className="space-y-3">
              <SummaryRow
                icon="person"
                label="Profile"
                value={username ? `@${username}` : 'Not set'}
                photo={avatar}
                onEdit={() => setStep('profile')}
              />
              <SummaryRow
                icon="tune"
                label="Genres"
                value={genres.length ? genres.join(', ') : 'Not set'}
                onEdit={() => setStep('genres')}
              />
              <SummaryRow
                icon="mic_external_on"
                label="Artists"
                value={selectedArtists.length ? selectedArtists.map(artistNameFor).join(', ') : 'Not set'}
                onEdit={() => setStep('artists')}
              />
              <SummaryRow
                icon="public"
                label="Country"
                value={country ? (getCountryName(country) || country) : 'Not set'}
                onEdit={() => setStep('personalization')}
              />
            </section>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center gap-3">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full border border-surface-variant px-5 py-3 font-body-sm text-on-surface hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
                Back
              </button>
            )}

            {step !== 'summary' ? (
              <button
                type="button"
                onClick={step === 'profile' ? handleProfileNext : () => goTo(STEPS[stepIndex + 1], step === 'genres' ? { genres } : step === 'artists' ? { selectedArtists } : { country })}
                disabled={!canContinue || saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-body-sm font-medium text-background hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Continue'}
                {!saving && <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-body-sm font-medium text-background hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all disabled:opacity-40"
              >
                {saving ? 'Finishing...' : 'Start listening'}
                {!saving && <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryRow({ icon, label, value, photo, onEdit }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-variant bg-surface-variant/30 p-3">
      {photo ? (
        <img src={photo} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
      ) : (
        <span className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]" aria-hidden="true">{icon}</span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-body-xs text-on-surface-variant">{label}</p>
        <p className="font-body-sm text-on-surface truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-full border border-surface-variant px-3 py-1.5 font-body-xs text-on-surface-variant hover:border-primary/60 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full transition-colors"
      >
        Edit
        <span className="sr-only"> {label}</span>
      </button>
    </div>
  );
}
