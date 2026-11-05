import { useState, useEffect } from 'react';
import { spotify } from '../services/spotify';
import { getBundledArtistPhoto } from '../data/artistPhotos';

// In-memory cache so we only ever look an artist name up once per session,
// no matter how many times it's rendered across the app.
const photoCache = new Map(); // name -> real photo url, or null if none found
let spotifyConfigured = null; // cached after the first check

// Offline-first: show a bundled local portrait immediately (never a broken
// external URL). When Spotify is configured, resolve the artist's real photo
// and swap it in if/when it becomes available.
export function useArtistPhoto(name, placeholder) {
  const bundled = getBundledArtistPhoto(name) || placeholder;
  const [photo, setPhoto] = useState(() => {
    if (name && photoCache.has(name)) return photoCache.get(name) || bundled;
    return bundled;
  });

  useEffect(() => {
    if (!name) return;
    if (photoCache.has(name)) {
      setPhoto(photoCache.get(name) || bundled);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (spotifyConfigured === null) {
          const config = await spotify.getConfig();
          spotifyConfigured = !!config.configured;
        }
        if (!spotifyConfigured) {
          photoCache.set(name, null);
          setPhoto(bundled);
          return;
        }
        const matches = await spotify.searchArtists(name, 1);
        const real = matches?.[0]?.photo || null;
        photoCache.set(name, real);
        if (!cancelled && real) setPhoto(real);
        else if (!cancelled) setPhoto(bundled);
      } catch {
        photoCache.set(name, null);
        setPhoto(bundled);
      }
    })();
    return () => { cancelled = true; };
  }, [name, bundled]); // eslint-disable-line react-hooks/exhaustive-deps

  return photo || bundled;
}
