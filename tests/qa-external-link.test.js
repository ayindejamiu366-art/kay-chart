import { describe, it, expect } from 'vitest';
import { externalLinkFor, youTubeIdFrom } from '../src/utils/externalLink.js';

describe('externalLinkFor', () => {
  it('derives the label from the URL instead of hardcoding Spotify', () => {
    expect(externalLinkFor({ externalUrl: 'https://open.spotify.com/track/abc' }).label).toBe('Open in Spotify');
    expect(externalLinkFor({ externalUrl: 'https://www.deezer.com/track/123' }).label).toBe('Open in Deezer');
    expect(externalLinkFor({ externalUrl: 'https://music.apple.com/us/album/x/1' }).label).toBe('Open in Apple Music');
    expect(externalLinkFor({ externalUrl: 'https://example.com/track/1' }).label).toBe('Open externally');
  });

  it('flags a YouTube link instead of letting it masquerade as Spotify', () => {
    const link = externalLinkFor({ externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    expect(link.isYouTube).toBe(true);
    expect(link.label).toBe('Watch on YouTube');
    expect(link.label).not.toMatch(/spotify/i);
    expect(link.videoId).toBe('dQw4w9WgXcQ');
  });

  it('refuses unsafe or malformed URLs', () => {
    expect(externalLinkFor({ externalUrl: 'javascript:alert(1)' })).toBeNull();
    expect(externalLinkFor({ externalUrl: 'data:text/html,<h1>x' })).toBeNull();
    expect(externalLinkFor({ externalUrl: 'not a url' })).toBeNull();
    expect(externalLinkFor({ externalUrl: '' })).toBeNull();
    expect(externalLinkFor({ externalUrl: 12345 })).toBeNull();
    expect(externalLinkFor({})).toBeNull();
    expect(externalLinkFor(null)).toBeNull();
  });

  it('does not attach a videoId to non-YouTube destinations', () => {
    const link = externalLinkFor({ externalUrl: 'https://www.deezer.com/track/1', videoId: 'stale' });
    expect(link.isYouTube).toBe(false);
    expect(link.videoId).toBeNull();
  });
});

describe('youTubeIdFrom', () => {
  it('reads the id from every YouTube URL shape', () => {
    expect(youTubeIdFrom('https://youtu.be/abc123XYZ')).toBe('abc123XYZ');
    expect(youTubeIdFrom('https://www.youtube.com/embed/emb456')).toBe('emb456');
    expect(youTubeIdFrom('https://youtube.com/shorts/sho789')).toBe('sho789');
    expect(youTubeIdFrom('https://m.youtube.com/watch?v=mov321&t=30')).toBe('mov321');
    expect(youTubeIdFrom('https://music.youtube.com/watch?v=mus999')).toBe('mus999');
  });

  it('returns null for anything that is not YouTube', () => {
    expect(youTubeIdFrom('https://open.spotify.com/track/abc')).toBeNull();
    expect(youTubeIdFrom(null)).toBeNull();
    expect(youTubeIdFrom('not a url')).toBeNull();
  });
});
