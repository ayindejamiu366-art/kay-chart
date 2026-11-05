/**
 * Offline music fixtures.
 *
 * `tests/music.test.cjs` exercises routes whose behaviour depends on live music
 * providers. Those tests used to hit Spotify, Deezer, Audius and Jamendo, which
 * made the suite fail for reasons that had nothing to do with the code under
 * test: rate limits (HTTP 429), upstream timeouts, and circuit breakers tripping
 * open and failing fast. Those are the four failures this file exists to remove.
 *
 * The music service is a singleton (`module.exports = musicService`), and the
 * routes hold a reference to that same object, so replacing its methods here
 * makes every route deterministic without touching production code or the HTTP
 * layer. Only the methods the tests actually exercise are replaced; anything
 * else keeps its real implementation.
 *
 * Call `installOfflineMusic()` before `createApp()`.
 */

const TRACKS = [
  { id: 'offline_t1', title: 'Offline Signal', artist: 'Fixture Artist', artist_id: 'offline_a1', album: 'Fixtures', duration: 181, artwork: '/fixtures/1.jpg', provider: 'local', genre: 'Pop' },
  { id: 'offline_t2', title: 'Cached Wire', artist: 'Second Fixture', artist_id: 'offline_a2', album: 'Fixtures', duration: 214, artwork: '/fixtures/2.jpg', provider: 'local', genre: 'Jazz' },
  { id: 'offline_t3', title: 'Last Known Good', artist: 'Third Fixture', artist_id: 'offline_a3', album: 'Fixtures', duration: 197, artwork: '/fixtures/3.jpg', provider: 'local', genre: 'Rock' },
];

const GENRES = [
  { id: 'offline_g1', name: 'Pop' },
  { id: 'offline_g2', name: 'Jazz' },
];

/**
 * Replace the provider-backed methods with deterministic fixtures.
 *
 * @returns {() => void} restore function, for use in afterAll.
 */
function installOfflineMusic() {
  // eslint-disable-next-line global-require
  const musicService = require('../server/providers/music-service.cjs');

  const original = {};
  const stub = (name, fn) => {
    original[name] = musicService[name];
    musicService[name] = fn;
  };

  // Signatures below mirror the real service, because the routes pass arguments
  // straight through: `getTrendingTracks(limit)` receives a number (not a genre),
  // and `searchTracks` returns an array that the route then wraps in `{ data }`.
  stub('getHome', async () => ({
    trending: TRACKS,
    popular: TRACKS,
    recommended: TRACKS,
    newReleases: TRACKS,
  }));

  stub('getTrendingTracks', async (limit) => (
    Number.isFinite(limit) ? TRACKS.slice(0, limit) : TRACKS
  ));

  stub('searchTracks', async (query, limit) => {
    const q = String(query || '').toLowerCase();
    const hits = q
      ? TRACKS.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
      : TRACKS;
    return Number.isFinite(limit) ? hits.slice(0, limit) : hits;
  });

  stub('getGenres', async () => GENRES);

  stub('getTrack', async (id) => TRACKS.find(t => t.id === id) || null);

  stub('getPopularTracks', async (limit) => (
    Number.isFinite(limit) ? TRACKS.slice(0, limit) : TRACKS
  ));
  stub('getPopularArtists', async (limit) => ([
    { id: 'offline_a1', name: 'Fixture Artist', image: '/fixtures/a1.jpg' },
  ].slice(0, Number.isFinite(limit) ? limit : 1)));
  stub('getTracksByCountry', async (countryCode, limit) => (
    Number.isFinite(limit) ? TRACKS.slice(0, limit) : TRACKS
  ));
  stub('getTracksByGenre', async (genreId, limit) => (
    Number.isFinite(limit) ? TRACKS.slice(0, limit) : TRACKS
  ));
  stub('getProviderStatus', async () => ({
    spotify: 'healthy', deezer: 'healthy', audius: 'healthy', local: 'healthy',
  }));

  return function restoreOfflineMusic() {
    for (const [name, fn] of Object.entries(original)) {
      if (fn === undefined) delete musicService[name];
      else musicService[name] = fn;
    }
  };
}

module.exports = { installOfflineMusic, OFFLINE_TRACKS: TRACKS, OFFLINE_GENRES: GENRES };