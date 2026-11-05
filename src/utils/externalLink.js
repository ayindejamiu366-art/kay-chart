/**
 * Resolves the "open this track somewhere else" link for a track.
 *
 * The previous code hardcoded the label "Open in Spotify" while opening whatever
 * `externalUrl` the track happened to carry, so a row pointing at YouTube was
 * announced as Spotify and the tap dumped the user out of the app. The label is
 * now derived from the URL itself, and a YouTube link is reported as such so the
 * caller can play it in-app instead of navigating away.
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

// Returns a normalised, validated URL or null. Anything that is not plain
// http(s) is refused, so a hostile `externalUrl` can never reach window.open.
function safeUrl(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null;
  return parsed.toString();
}

const isYouTubeUrl = (url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host === 'music.youtube.com';
  } catch {
    return false;
  }
};

// Pulls a watchable video id out of any of the YouTube URL shapes.
export function youTubeIdFrom(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const LABEL_BY_HOST = [
  [/(\.)?spotify\.com$/i, 'Open in Spotify'],
  [/(\.)?deezer\.com$/i, 'Open in Deezer'],
  [/(\.)?music\.apple\.com$/i, 'Open in Apple Music'],
  [/(\.)?tidal\.com$/i, 'Open in Tidal'],
  [/(\.)?youtube\.com$|(\.)?youtu\.be$/i, 'Watch on YouTube'],
  [/(\.)?audius\.co$/i, 'Open on Audius'],
  [/(\.)?bandcamp\.com$/i, 'Open on Bandcamp'],
  [/(\.)?soundcloud\.com$/i, 'Open on SoundCloud'],
];

/**
 * @returns {{url: string, label: string, host: string, isYouTube: boolean, videoId: string|null}|null}
 */
export function externalLinkFor(track) {
  if (!track) return null;
  const url = safeUrl(track.externalUrl);
  if (!url) return null;

  const host = new URL(url).hostname.replace(/^www\./, '');
  const yt = isYouTubeUrl(url);
  // videoId only means something for a YouTube destination. Carrying a stale id
  // on a Deezer/Spotify link would let a caller "play in app" the wrong thing.
  const videoId = yt ? (youTubeIdFrom(url) || track.videoId || null) : null;

  const match = LABEL_BY_HOST.find(([re]) => re.test(host));
  const label = match ? match[1] : 'Open externally';

  return { url, label, host, isYouTube: yt, videoId };
}
