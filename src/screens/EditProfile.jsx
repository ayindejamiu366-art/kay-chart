import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import api from '../services/api';
import { useI18n } from '../context/I18nContext';
import { Skeleton } from '../components/skeleton';

const USERNAME_RULES = '3-20 characters. Letters, numbers and underscores only.';
const isValidUsernameFormat = (value) => /^[A-Za-z0-9_]{3,20}$/.test(value);

export default function EditProfile() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, setUser, refreshUser } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [availability, setAvailability] = useState({ state: 'idle', message: '' });
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [avatarFile, setAvatarFile] = useState(null);
  // A data-URL preview resolves immediately; a stored avatar URL may still be
  // in flight, so the placeholder is held until the image reports it decoded.
  const [avatarPreviewLoaded, setAvatarPreviewLoaded] = useState(!user?.avatar);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const availabilityTimer = useRef(null);

  useEffect(() => () => {
    if (availabilityTimer.current) clearTimeout(availabilityTimer.current);
  }, []);

  // Same debounced availability contract as the setup wizard, so the two cannot
  // disagree about what is a valid or free username.
  const handleUsernameChange = (event) => {
    const value = event.target.value.replace(/\s/g, '');
    setUsername(value);
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
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(t('EDIT_PROFILE_ERROR_IMAGE_SIZE'));
      return;
    }
    const reader = new FileReader();
    // Hold the placeholder while the file is being read, so picking a photo
    // does not momentarily show the previous image or an empty circle.
    setAvatarPreviewLoaded(false);
    reader.onload = () => {
      setAvatarPreview(reader.result);
      setAvatarFile(file);
      setAvatarPreviewLoaded(true);
      setError('');
    };
    reader.onerror = () => {
      // Never leave the avatar stuck as a placeholder if the read fails.
      setAvatarPreviewLoaded(true);
      setError(t('EDIT_PROFILE_ERROR_IMAGE_SIZE'));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('EDIT_PROFILE_ERROR_NAME_EMPTY'));
      return;
    }
    const candidate = username.trim();
    if (candidate && !isValidUsernameFormat(candidate)) {
      setError(USERNAME_RULES);
      return;
    }
    if (availability.state === 'checking') {
      setError('Still checking that username — one moment.');
      return;
    }
    if (availability.state === 'taken') {
      setError('That username is already taken.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // The avatar goes through the validated upload endpoint rather than being
      // stored as a raw data URL, so type, size and dimensions are all checked.
      let avatarResult = null;
      if (avatarFile) {
        avatarResult = await api.uploadProfileAvatar(avatarFile);
      }

      const updates = {};
      if (name.trim() !== user?.name) updates.name = name.trim();
      if (candidate !== (user?.username || '')) updates.username = candidate;

      if (!Object.keys(updates).length && !avatarResult) {
        setSaving(false);
        navigate(-1);
        return;
      }

      let result = avatarResult;
      if (Object.keys(updates).length) {
        result = await api.updateProfile(updates);
      }
      if (result?.user) {
        setUser(result.user);
      } else {
        await refreshUser();
      }
      setSaved(true);
      setTimeout(() => navigate(-1), 1000);
    } catch (err) {
      setError(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  if (saved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background page-enter">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center mb-4 animate-bounce">
          <span className="material-symbols-outlined text-green-500 text-[32px]">check_circle</span>
        </div>
        <p className="font-headline-md text-headline-md text-on-surface">{t('EDIT_PROFILE_SUCCESS')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background page-enter">
      <header className="w-full sticky top-0 z-40 bg-background/70 backdrop-blur-xl flex items-center justify-between px-6 py-4">
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-md text-headline-md text-on-surface">{t('EDIT_PROFILE_HEADING')}</h1>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="text-primary font-body-md text-body-md font-semibold press-feedback disabled:opacity-40">
          {saving ? t('EDIT_PROFILE_SAVING') : t('EDIT_PROFILE_SAVE')}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-8">
        {/* Avatar Section */}
        <div className="flex flex-col items-center pt-6 pb-8 fade-up">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-[30px]" />
            <button onClick={handlePickImage} className="relative z-10 w-[120px] h-[120px] rounded-full overflow-hidden border-[3px] border-primary shadow-[0_0_24px_rgba(214,255,61,0.3)] press-feedback group">
              {/* While a chosen photo is being read into a preview, hold the
                  avatar's shape rather than flashing a broken image or the
                  generic person glyph. The upload itself is unchanged. */}
              {avatarPreview && !avatarPreviewLoaded ? (
                <Skeleton className="w-full h-full" radius="rounded-full" animation="pulse" />
              ) : avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" onLoad={() => setAvatarPreviewLoaded(true)} />
              ) : (
                <div className="w-full h-full bg-surface-card flex items-center justify-center">
                  <span className="material-symbols-outlined icon-fill text-primary text-[48px]">person</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-white text-[28px]">photo_camera</span>
              </div>
            </button>
            <div className="absolute -bottom-1 -right-1 z-20 w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-background text-[18px]">photo_camera</span>
            </div>
          </div>
          <button onClick={handlePickImage} className="font-body-sm text-body-sm text-primary font-semibold press-feedback">
            {t('EDIT_PROFILE_CHANGE_PHOTO')}
          </button>
          <p className="font-body-xs text-body-xs text-on-surface-variant mt-1">{t('EDIT_PROFILE_PHOTO_HINT')}</p>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center gap-2 fade-up">
            <span className="material-symbols-outlined text-red-400 text-[18px]">error</span>
            <p className="font-body-sm text-body-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Name Field */}
        <div className="fade-up fade-up-1">
          <label className="font-label-lg text-label-lg text-on-surface-variant mb-2 block">{t('EDIT_PROFILE_NAME_LABEL')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('EDIT_PROFILE_NAME_PLACEHOLDER')}
            className="w-full h-14 px-5 rounded-xl bg-surface-card border border-border-subtle text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Username Field */}
        <div className="mt-5 fade-up fade-up-1">
          <label htmlFor="edit-username" className="font-label-lg text-label-lg text-on-surface-variant mb-2 block">Username</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-body-md" aria-hidden="true">@</span>
            <input
              id="edit-username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              maxLength={20}
              spellCheck={false}
              autoComplete="username"
              placeholder="yourname"
              aria-describedby="edit-username-help edit-username-status"
              aria-invalid={availability.state === 'taken' || availability.state === 'invalid'}
              className="w-full h-14 pl-8 pr-11 rounded-xl bg-surface-card border border-border-subtle text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
            />
            {availability.state === 'checking' && (
              <span className="absolute right-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[18px] animate-spin" aria-hidden="true">progress_activity</span>
            )}
            {availability.state === 'available' && (
              <span className="absolute right-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary text-[18px]" aria-hidden="true">check_circle</span>
            )}
            {availability.state === 'taken' && (
              <span className="absolute right-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-red-400 text-[18px]" aria-hidden="true">error</span>
            )}
          </div>
          <p id="edit-username-help" className="font-body-xs text-body-xs text-on-surface-variant mt-1.5">{USERNAME_RULES}</p>
          <p
            id="edit-username-status"
            role="status"
            aria-live="polite"
            className={`font-body-xs text-body-xs mt-1 min-h-[1rem] ${
              availability.state === 'available' ? 'text-primary'
                : availability.state === 'taken' || availability.state === 'invalid' || availability.state === 'error' ? 'text-red-400'
                  : 'text-transparent'
            }`}
          >
            {availability.message || 'placeholder'}
          </p>
        </div>

        {/* Email (read-only) */}
        <div className="mt-5 fade-up fade-up-2">
          <label className="font-label-lg text-label-lg text-on-surface-variant mb-2 block">{t('EDIT_PROFILE_EMAIL_LABEL')}</label>
          <div className="w-full h-14 px-5 rounded-xl bg-surface-card/50 border border-border-subtle/50 flex items-center">
            <span className="font-body-md text-body-md text-on-surface-variant">{user?.email}</span>
            <span className="material-symbols-outlined text-on-surface-variant/30 text-[18px] ml-auto">lock</span>
          </div>
        </div>

        {/* Role (read-only) */}
        <div className="mt-5 fade-up fade-up-3">
          <label className="font-label-lg text-label-lg text-on-surface-variant mb-2 block">{t('EDIT_PROFILE_ROLE_LABEL')}</label>
          <div className="w-full h-14 px-5 rounded-xl bg-surface-card/50 border border-border-subtle/50 flex items-center">
            <span className="material-symbols-outlined text-primary text-[20px] mr-3">{user?.role === 'admin' ? 'shield' : user?.role === 'artist' ? 'mic' : 'person'}</span>
            <span className="font-body-md text-body-md text-on-surface">{user?.role === 'admin' ? t('EDIT_PROFILE_ROLE_ADMIN') : user?.role === 'artist' ? t('EDIT_PROFILE_ROLE_ARTIST') : t('EDIT_PROFILE_ROLE_LISTENER')}</span>
          </div>
        </div>

        {/* Save Button (mobile) */}
        <div className="mt-8 fade-up fade-up-4">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full h-14 rounded-full btn-primary font-headline-md text-headline-md flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            ) : (
              <>{t('EDIT_PROFILE_SAVE_CHANGES')}<span className="material-symbols-outlined text-[20px]">check</span></>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
