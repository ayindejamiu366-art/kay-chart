import { useArtistPhoto } from '../hooks/useArtistPhoto';
import CoverImage from './CoverImage';

// Drop-in replacement for <CoverImage type="artist" .../> when the photo
// you have is a bundled placeholder rather than a confirmed real photo
// (e.g. entries from the local/offline library). Looks up the artist's
// real photo via Spotify when configured; otherwise renders the
// placeholder unchanged.
export default function ArtistAvatar({ name, photo, className = '', rounded = 'rounded-full' }) {
  const resolvedPhoto = useArtistPhoto(name, photo);
  return <CoverImage src={resolvedPhoto} alt={name} type="artist" className={className} rounded={rounded} />;
}
