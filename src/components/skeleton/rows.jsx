/**
 * Shared row-shaped skeletons.
 *
 * Search, Artist, Album, Playlist, Charts and Library all render the same few
 * row shapes at different sizes. Defining them once keeps those screens
 * consistent with each other and with Home, and means a change to the row
 * geometry lands everywhere.
 *
 * Sizes default to the values used by src/screens/SearchResults.jsx and
 * src/screens/Home.jsx so the placeholders sit in exactly the space the real
 * rows will occupy.
 */
import { Skeleton, SkeletonText, SkeletonCircle } from './Skeleton';

/**
 * A track row: rank, artwork, title, artist, duration/actions.
 *
 * @param {object} props
 * @param {number|string} [props.artworkSize] 40 for Home rows, 48 for Search.
 * @param {boolean} [props.rank]               Show a rank slot (charts).
 * @param {boolean} [props.action]             Show the trailing action cluster.
 */
function SkeletonTrackRow({ artworkSize = 40, rank = false, action = true, className = '' }) {
  return (
    <div className={`w-full min-w-0 flex items-center gap-3 p-2 rounded-xl ${className}`.trim()} aria-hidden="true">
      {rank ? (
        <Skeleton width={10} height={12} radius="3px" className="shrink-0" />
      ) : (
        <span className="w-6 shrink-0" />
      )}
      <Skeleton
        className="shrink-0"
        width={artworkSize}
        height={artworkSize}
        radius={artworkSize <= 40 ? 'rounded-lg' : 'rounded-xl'}
      />
      {/* `min-w-0` lets the percentage-width text bars shrink instead of
          forcing the row wider than a 375px viewport. */}
      <div className="flex-1 min-w-0">
        <SkeletonText width="58%" height={13} className="mb-1.5" />
        <SkeletonText width="38%" height={11} />
      </div>
      {action ? (
        <div className="flex items-center gap-3 shrink-0">
          {/* Trailing duration text, then the action control. */}
          <SkeletonText width={28} height={11} />
          <SkeletonCircle size={22} />
        </div>
      ) : (
        <SkeletonText width={28} height={11} className="shrink-0" />
      )}
    </div>
  );
}

/**
 * The "top result" artist card from Search: a large circular avatar beside a
 * name and a badge.
 */
function SkeletonArtistResultRow({ size = 80 }) {
  return (
    <div className="w-full bg-surface-card rounded-2xl border border-border-subtle p-4 flex items-center gap-4" aria-hidden="true">
      <SkeletonCircle size={size} />
      <div className="flex flex-col flex-1 min-w-0">
        <SkeletonText width="52%" height={22} radius="6px" className="mb-2" />
        <SkeletonText width={72} height={10} radius="3px" />
      </div>
    </div>
  );
}

/** An album result row: square artwork, title, artist. */
function SkeletonAlbumRow({ artworkSize = 56 }) {
  return (
    <div className="w-full flex items-center gap-3 p-2 rounded-2xl" aria-hidden="true">
      <Skeleton width={artworkSize} height={artworkSize} radius="rounded-lg" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <SkeletonText width="54%" height={14} className="mb-1.5" />
        <SkeletonText width="34%" height={11} />
      </div>
    </div>
  );
}

/** A grid tile used by Library and Playlist grids. */
function SkeletonGridTile({ width }) {
  return (
    <div className="shrink-0 snap-start" style={width ? { width } : undefined} aria-hidden="true">
      <Skeleton className="w-full aspect-square mb-2.5" radius="rounded-2xl" />
      <SkeletonText width="84%" height={13} className="mb-1.5" />
      <SkeletonText width="54%" height={11} />
    </div>
  );
}

/**
 * A vertical list of track rows, for list-shaped screens (Liked Songs,
 * Downloads, a playlist's track list).
 *
 * Each row reserves the same box as `SkeletonTrackRow`, so switching from
 * placeholder to real rows does not change the page height.
 */
function SkeletonTrackList({ rows = 8, artworkSize = 48, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonTrackRow key={i} artworkSize={artworkSize} />
      ))}
    </div>
  );
}

/**
 * A vertical list of the Library's larger cards.
 *
 * The Library rows are 64px artwork inside a padded card rather than the
 * 48px track rows used elsewhere, so this mirrors that shape specifically
 * instead of reusing the track list and letting the page resize on load.
 */
function SkeletonLibraryList({ rows = 6 }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="p-4 rounded-2xl bg-surface-card border border-border-subtle flex items-center gap-4">
          <Skeleton width={64} height={64} radius="rounded-xl" className="shrink-0" />
          <div className="flex-grow min-w-0">
            <SkeletonText width="58%" height={14} className="mb-2" />
            <SkeletonText width="36%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

export {
  SkeletonTrackRow,
  SkeletonArtistResultRow,
  SkeletonAlbumRow,
  SkeletonGridTile,
  SkeletonTrackList,
  SkeletonLibraryList,
};
