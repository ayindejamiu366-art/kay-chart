/**
 * Multi-Provider Music System
 * 
 * Each provider must implement:
 *   name, capabilities, searchTracks, getTrack, searchArtists, getArtist,
 *   getArtistTopTracks, getArtistAlbums, searchAlbums, getAlbum, getAlbumTracks,
 *   getTrendingTracks, getGenres, getTracksByGenre, getTracksByCountry, healthCheck
 */

const { DeezerProvider } = require('./deezer.cjs');
const { AudiusProvider } = require('./audius.cjs');
const { SpotifyProvider } = require('./spotify.cjs');
const { LocalProvider } = require('./local.cjs');
const { JamendoProvider } = require('./jamendo.cjs');

const PROVIDER_FACTORIES = {
  deezer: (config) => new DeezerProvider(config),
  audius: (config) => new AudiusProvider(config),
  spotify: (config) => new SpotifyProvider(config),
  local: (config) => new LocalProvider(config),
  jamendo: (config) => new JamendoProvider(config),
};

let activeProviders = [];
let providerInstances = new Map();

function getProviderConfig() {
  const configs = [];
  let i = 1;
  while (process.env[`MUSIC_PROVIDER_${i}`]) {
    const name = process.env[`MUSIC_PROVIDER_${i}`].toLowerCase();
    configs.push({
      name,
      apiKey: process.env[`MUSIC_PROVIDER_${i}_API_KEY`] || '',
      baseUrl: process.env[`MUSIC_PROVIDER_${i}_BASE_URL`] || '',
    });
    i++;
  }
  if (configs.length === 0) {
    configs.push({
      name: process.env.MUSIC_PROVIDER || 'deezer',
      apiKey: process.env.MUSIC_PROVIDER_API_KEY || '',
      baseUrl: process.env.MUSIC_PROVIDER_BASE_URL || '',
    });
  }
  return configs;
}

function initProviders() {
  const configs = getProviderConfig();
  activeProviders = [];
  providerInstances.clear();

  for (const cfg of configs) {
    const factory = PROVIDER_FACTORIES[cfg.name];
    if (!factory) {
      console.warn(`[Providers] Unknown provider: ${cfg.name}, skipping`);
      continue;
    }
    try {
      const instance = factory(cfg);
      providerInstances.set(cfg.name, instance);
      activeProviders.push(instance);
      console.log(`[Providers] Initialized: ${cfg.name}`);
    } catch (e) {
      console.error(`[Providers] Failed to init ${cfg.name}:`, e.message);
    }
  }

  if (activeProviders.length === 0) {
    console.error('[Providers] No providers initialized! Falling back to deezer');
    try {
      const fallback = new DeezerProvider();
      providerInstances.set('deezer', fallback);
      activeProviders.push(fallback);
    } catch (e) {
      console.error('[Providers] Even deezer fallback failed:', e.message);
    }
  }

  return activeProviders;
}

function getActiveProviders() {
  if (activeProviders.length === 0) initProviders();
  return activeProviders;
}

function getProviderByName(name) {
  return providerInstances.get(name) || null;
}

function getPrimaryProvider() {
  const providers = getActiveProviders();
  return providers[0] || null;
}

module.exports = {
  PROVIDER_FACTORIES,
  getProviderConfig,
  initProviders,
  getActiveProviders,
  getProviderByName,
  getPrimaryProvider,
  getActiveProvider: getPrimaryProvider,
  getProvider: getPrimaryProvider,
};
