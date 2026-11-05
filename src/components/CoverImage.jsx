import { useRef, useState } from 'react';
import { gsap } from 'gsap';
import { prefersReduced } from '../utils/gsap';
import { getSongCover, getAlbumCover, getArtistPhoto, getPlaylistCover, getUserAvatar } from '../utils/placeholders';

function CoverImage({ src, alt, type = 'song', className = '', rounded = 'rounded-lg', fallback = null }) {
  const sizeMap = { song: 48, album: 150, artist: 150, playlist: 150, user: 48 };
  const size = sizeMap[type] || 48;
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  const getPlaceholder = () => {
    switch (type) {
      case 'song': return getSongCover({ title: alt, cover: null });
      case 'album': return getAlbumCover({ title: alt, cover: null });
      case 'artist': return getArtistPhoto({ name: alt, cover: null });
      case 'playlist': return getPlaylistCover({ title: alt, cover: null });
      case 'user': return getUserAvatar({ name: alt, avatar: null });
      default: return getSongCover({ title: alt, cover: null });
    }
  };

  const finalSrc = src || getPlaceholder();

  const handleLoad = () => {
    setLoaded(true);
    if (!prefersReduced && imgRef.current) {
      gsap.fromTo(imgRef.current,
        { scale: 1.08, opacity: 0.5 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out', overwrite: 'auto' }
      );
    }
  };

  if (fallback && !src) return fallback;

  return (
    <img
      ref={imgRef}
      src={finalSrc}
      alt={alt || type}
      className={`object-cover ${rounded} ${className}`}
      loading="lazy"
      onLoad={handleLoad}
      onError={(e) => { e.target.src = getPlaceholder(); }}
      style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
    />
  );
}

export default CoverImage;
