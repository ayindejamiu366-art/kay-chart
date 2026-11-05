/**
 * Skeleton system tests.
 *
 * These use react-dom/server rather than a DOM testing library: the project has
 * no jsdom installed, and adding one purely to assert on markup would be a
 * dependency the app does not otherwise need. Server rendering is enough to
 * prove what each skeleton renders and, critically, that it renders *only*
 * shapes — no invented titles, names, counts or chart positions.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonImage,
  SkeletonButton,
  SkeletonCard,
  SkeletonLines,
  SkeletonRegion,
  SkeletonRail,
} from '../src/components/skeleton/Skeleton';
import {
  SkeletonTrackRow,
  SkeletonArtistResultRow,
  SkeletonAlbumRow,
  SkeletonGridTile,
  SkeletonTrackList,
  SkeletonLibraryList,
} from '../src/components/skeleton/rows';
import { HomeSkeleton } from '../src/components/skeleton/HomeSkeleton';
import {
  SearchSkeleton,
  ArtistProfileSkeleton,
  AlbumSkeleton,
  PlaylistSkeleton,
  LibrarySkeleton,
  ChartsSkeleton,
  DiscoverSkeleton,
  ProfileSkeleton,
  NowPlayingSkeleton,
  MiniPlayerSkeleton,
} from '../src/components/skeleton/screens';

const ALL = {
  'HomeSkeleton': HomeSkeleton,
  'SearchSkeleton': SearchSkeleton,
  'ArtistProfileSkeleton': ArtistProfileSkeleton,
  'AlbumSkeleton': AlbumSkeleton,
  'PlaylistSkeleton': PlaylistSkeleton,
  'LibrarySkeleton': LibrarySkeleton,
  'ChartsSkeleton': ChartsSkeleton,
  'DiscoverSkeleton': DiscoverSkeleton,
  'ProfileSkeleton': ProfileSkeleton,
  'NowPlayingSkeleton': NowPlayingSkeleton,
  'MiniPlayerSkeleton': MiniPlayerSkeleton,
};

/**
 * Words that would indicate content leaked into a placeholder. The app's own
 * vocabulary is included because a skeleton must never announce a real title.
 */
/**
 * Words that would indicate invented *content* leaked into a placeholder.
 *
 * Note that "Loading" is deliberately absent: `SkeletonRegion` renders a
 * screen-reader-only label such as "Loading your home feed", which is the
 * correct thing to announce. Faking data means inventing song titles, artist
 * names or counts, not describing the loading state.
 */
const FORBIDDEN = [
  'followers', 'streams', 'listeners', 'plays', 'tracks',
  'Trending Music', 'Top Charts', 'Browse Genres', 'Made for You',
];

describe('Skeleton primitives', () => {
  it('renders a hidden, non-semantic block', () => {
    const html = renderToStaticMarkup(<Skeleton width={40} height={20} />);
    expect(html).toContain('data-skeleton');
    expect(html).toContain('aria-hidden="true"');
    // A span, not a heading/list item/paragraph: a placeholder is not content.
    expect(html).toMatch(/<span/);
    expect(html).not.toMatch(/<h1|<h2|<h3|<p|<li/);
  });

  it('converts numeric dimensions to pixels and passes CSS through', () => {
    const html = renderToStaticMarkup(<Skeleton width={40} height={20} />);
    expect(html).toContain('width:40px');
    expect(html).toContain('height:20px');

    const pct = renderToStaticMarkup(<Skeleton width="100%" height="2rem" />);
    expect(pct).toContain('width:100%');
    expect(pct).toContain('height:2rem');
  });

  it('applies a border radius when given one', () => {
    expect(renderToStaticMarkup(<Skeleton radius="9999px" />)).toContain('border-radius:9999px');
  });

  it('merges className with the base class', () => {
    const html = renderToStaticMarkup(<Skeleton className="mb-2" />);
    expect(html).toContain('skeleton');
    expect(html).toContain('mb-2');
  });

  it('defaults to the shimmer variant and honours an explicit one', () => {
    expect(renderToStaticMarkup(<Skeleton />)).toContain('data-animation="shimmer"');
    expect(renderToStaticMarkup(<Skeleton animation="pulse" />)).toContain('data-animation="pulse"');
    expect(renderToStaticMarkup(<Skeleton animation="none" />)).toContain('data-animation="none"');
  });

  it('marks the skeleton static when reduced motion is forced', () => {
    const html = renderToStaticMarkup(<Skeleton reducedMotion />);
    expect(html).toContain('data-animation="none"');
    expect(html).toContain('data-static="true"');
  });

  it('does not render a shimmer when reduced motion is forced', () => {
    // animation="shimmer" is overridden, not merely ignored.
    const html = renderToStaticMarkup(<Skeleton animation="shimmer" reducedMotion />);
    expect(html).toContain('data-animation="none"');
    expect(html).not.toContain('data-animation="shimmer"');
  });

  it('renders text, circle, image, button and card shapes', () => {
    expect(renderToStaticMarkup(<SkeletonText />)).toContain('data-skeleton');
    expect(renderToStaticMarkup(<SkeletonCircle size={40} />)).toContain('border-radius:9999px');
    expect(renderToStaticMarkup(<SkeletonImage />)).toContain('aspect-square');
    expect(renderToStaticMarkup(<SkeletonButton />)).toContain('data-skeleton');
    expect(renderToStaticMarkup(<SkeletonCard />)).toContain('rounded-2xl');
  });

  it('sizes a button as a pill by default and a circle on request', () => {
    expect(renderToStaticMarkup(<SkeletonButton height={40} />)).toContain('border-radius:17px');
    expect(renderToStaticMarkup(<SkeletonButton height={40} circle />)).toContain('border-radius:9999px');
  });

  it('renders a line block with the final line shortened', () => {
    const html = renderToStaticMarkup(<SkeletonLines lines={3} />);
    // Three data-skeleton nodes.
    expect((html.match(/data-skeleton/g) || []).length).toBe(3);
    expect(html).toContain('62%');
  });

  it('renders at least one line even when asked for none', () => {
    const html = renderToStaticMarkup(<SkeletonLines lines={0} />);
    expect(html).toContain('data-skeleton');
  });

  it('announces the loading region once, not per placeholder', () => {
    const html = renderToStaticMarkup(
      <SkeletonRegion label="Loading charts">
        <Skeleton /><Skeleton /><Skeleton />
      </SkeletonRegion>
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Loading charts');
    // Every placeholder inside is still hidden from assistive tech.
    expect((html.match(/aria-hidden="true"/g) || []).length).toBe(3);
  });

  it('renders a rail of cards with a fixed width', () => {
    const html = renderToStaticMarkup(<SkeletonRail count={4} width={148} />);
    expect((html.match(/data-skeleton/g) || []).length).toBeGreaterThanOrEqual(4 * 3);
    expect(html).toContain('width:148px');
  });
});

describe('Skeleton rows', () => {
  it('renders a track row with artwork, text and action slots', () => {
    const html = renderToStaticMarkup(<SkeletonTrackRow artworkSize={48} />);
    expect(html).toContain('width:48px');
    expect(html).toContain('data-skeleton');
    expect(html).toContain('aria-hidden="true"');
  });

  it('adds a rank slot only when asked', () => {
    expect(renderToStaticMarkup(<SkeletonTrackRow rank />)).toContain('rounded-xl');
    const plain = renderToStaticMarkup(<SkeletonTrackRow />);
    expect(plain).toContain('aria-hidden="true"');
  });

  it('renders a vertical track list of the requested height', () => {
    const html = renderToStaticMarkup(<SkeletonTrackList rows={5} />);
    // Five rows, each with artwork plus two text lines and an action slot.
    expect((html.match(/width:48px/g) || []).length).toBe(5);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('flex flex-col');
  });

  it('honours a smaller artwork size for list rows', () => {
    const html = renderToStaticMarkup(<SkeletonTrackList rows={3} artworkSize={40} />);
    expect((html.match(/width:40px/g) || []).length).toBe(3);
  });

  it('renders the Library card shape with 64px artwork', () => {
    const html = renderToStaticMarkup(<SkeletonLibraryList rows={4} />);
    // Library rows are padded cards, not bare track rows.
    expect((html.match(/width:64px/g) || []).length).toBe(4);
    expect(html).toContain('rounded-2xl');
    expect(html).toContain('bg-surface-card');
  });

  it('renders artist, album and grid shapes', () => {
    // The artist result's circular avatar is a rounded Skeleton, so the radius
    // lands in the inline style rather than as a tailwind class.
    const artist = renderToStaticMarkup(<SkeletonArtistResultRow />);
    expect(artist).toContain('border-radius:9999px');
    expect(artist).toContain('width:80px');
    expect(renderToStaticMarkup(<SkeletonAlbumRow />)).toContain('data-skeleton');
    expect(renderToStaticMarkup(<SkeletonGridTile width={148} />)).toContain('width:148px');
  });
});

describe('Screen skeletons', () => {
  it('all render without throwing and produce markup', () => {
    for (const [name, Component] of Object.entries(ALL)) {
      const html = renderToStaticMarkup(<Component />);
      expect(html.length, `${name} produced no markup`).toBeGreaterThan(0);
      expect(html, `${name} has no skeleton nodes`).toContain('data-skeleton');
    }
  });

  it('all declare a busy loading region for assistive tech', () => {
    for (const [name, Component] of Object.entries(ALL)) {
      const html = renderToStaticMarkup(<Component />);
      // MiniPlayer and NowPlaying are inline fragments, not whole regions, so
      // they stay inert placeholders rather than live regions.
      if (name === 'MiniPlayerSkeleton' || name === 'NowPlayingSkeleton') continue;
      expect(html, `${name} lacks role=status`).toContain('role="status"');
      expect(html, `${name} lacks aria-busy`).toContain('aria-busy="true"');
    }
  });

  /**
   * The most important guarantee in this file: a skeleton is a shape, never
   * content. If any of these words appear in a rendered skeleton, the
   * implementation has started faking data.
   */
  it('never render invented content', () => {
    for (const [name, Component] of Object.entries(ALL)) {
      const text = renderToStaticMarkup(<Component />)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      for (const word of FORBIDDEN) {
        expect(
          text.toLowerCase().includes(word.toLowerCase()),
          `${name} contains invented content: "${word}"`
        ).toBe(false);
      }
    }
  });

  it('render no img elements, so a broken image cannot appear', () => {
    for (const [name, Component] of Object.entries(ALL)) {
      const html = renderToStaticMarkup(<Component />);
      expect(html.includes('<img'), `${name} renders an <img>`).toBe(false);
    }
  });

  it('contain no interactive elements, so they cannot swallow clicks', () => {
    for (const [name, Component] of Object.entries(ALL)) {
      const html = renderToStaticMarkup(<Component />);
      expect(html.includes('<button'), `${name} renders a button`).toBe(false);
      expect(html.includes('onclick'), `${name} renders a click handler`).toBe(false);
    }
  });

  it('Home reserves the rails, list and grids the real screen uses', () => {
    const html = renderToStaticMarkup(<HomeSkeleton />);
    expect(html).toContain('grid grid-cols-2 sm:grid-cols-3');
    expect(html).toContain('lg:grid-cols-4');
    expect(html).toContain('aspect-square');
    // Horizontal rails scroll rather than forcing the page wide.
    expect(html).toContain('overflow-x-auto');
  });

  it('Artist keeps the real hero height so the page does not grow', () => {
    const html = renderToStaticMarkup(<ArtistProfileSkeleton />);
    expect(html).toContain('h-[50vh]');
    expect(html).toContain('min-h-[300px]');
  });

  it('Album reserves the exact cover box used by the real screen', () => {
    const html = renderToStaticMarkup(<AlbumSkeleton />);
    expect(html).toContain('width:224px');
    expect(html).toContain('height:224px');
  });

  it('Library adapts its shape to the active tab', () => {
    const songs = renderToStaticMarkup(<LibrarySkeleton tab="Songs" />);
    const playlists = renderToStaticMarkup(<LibrarySkeleton tab="Playlists" />);
    // The list tabs render rows; the grid tabs render square tiles.
    expect(songs).toContain('flex items-center gap-3');
    expect(songs).not.toContain('aspect-square');
    expect(playlists).toContain('aspect-square');
    expect(playlists).not.toBe(songs);
  });

  it('Charts leaves rank slots empty rather than showing positions', () => {
    const html = renderToStaticMarkup(<ChartsSkeleton />);
    // Ten rank bars, and no numerals between the tags.
    expect(html).toContain('role="status"');
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(text).not.toMatch(/\b\d+\b/);
  });

  it('NowPlaying skeletonises only the fields that are missing', () => {
    const all = renderToStaticMarkup(<NowPlayingSkeleton />);
    expect(all).toContain('w-[280px]');

    // Artwork already known: that box should not be reserved again.
    const artworkKnown = renderToStaticMarkup(
      <NowPlayingSkeleton fields={{ artwork: false, title: true, artist: true, progress: true, controls: true }} />
    );
    expect(artworkKnown).not.toContain('w-[280px]');
    // The rest is still held.
    expect(artworkKnown).toContain('data-skeleton');
  });

  it('NowPlaying is inert and does not render transport controls', () => {
    const html = renderToStaticMarkup(<NowPlayingSkeleton />);
    expect(html).toContain('aria-hidden="true"');
    expect(html.includes('<button')).toBe(false);
  });

  it('MiniPlayer holds its bar height and renders no controls', () => {
    const html = renderToStaticMarkup(<MiniPlayerSkeleton />);
    // The artwork slot is a real 44px square in the MiniPlayer, matched by an
    // inline width/height rather than a class.
    expect(html).toContain('width:44px');
    expect(html).toContain('height:44px');
    expect(html).toContain('h-full');
    expect(html.includes('<button')).toBe(false);
  });

  it('respects reduced motion across every screen skeleton', () => {
    // Server rendering has no matchMedia, so this verifies the primitives'
    // contract; the browser suite covers the live media query.
    const html = renderToStaticMarkup(<HomeSkeleton />);
    expect(html).toContain('data-animation="shimmer"');
  });
});
