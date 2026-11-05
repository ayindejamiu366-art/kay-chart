/**
 * Screen skeletons.
 *
 * Each export mirrors one real screen's layout, using that screen's own
 * container widths and element sizes, so the placeholder occupies the same space
 * the loaded content will. These are purely visual: no titles, names, follower
 * counts, chart positions or durations are invented anywhere in this file.
 */
import {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonImage,
  SkeletonButton,
  SkeletonLines,
  SkeletonRegion,
  SkeletonRail,
} from './Skeleton';
import {
  SkeletonTrackRow,
  SkeletonArtistResultRow,
  SkeletonAlbumRow,
  SkeletonGridTile,
} from './rows';

/* ── Search ─────────────────────────────────────────────────────────────
   Mirrors SearchResults.jsx: a top-result artist card, then song rows, then
   album/artist sections. The filter chips are real content and stay visible. */
export function SearchSkeleton() {
  return (
    <SkeletonRegion label="Searching" className="flex flex-col gap-6">
      <section aria-hidden="true">
        <SkeletonText width={112} height={18} className="mb-3" />
        <SkeletonArtistResultRow />
      </section>

      <section aria-hidden="true">
        <SkeletonText width={72} height={18} className="mb-3" />
        <div className="flex flex-col gap-1">
          {Array.from({ length: 6 }, (_, i) => <SkeletonTrackRow key={i} artworkSize={48} />)}
        </div>
      </section>

      <section aria-hidden="true">
        <SkeletonText width={86} height={18} className="mb-3" />
        <div className="flex flex-col gap-1">
          {Array.from({ length: 3 }, (_, i) => <SkeletonAlbumRow key={i} />)}
        </div>
      </section>

      <section aria-hidden="true">
        <SkeletonText width={78} height={18} className="mb-3" />
        <div className="flex flex-col gap-1">
          {Array.from({ length: 3 }, (_, i) => <SkeletonTrackRow key={i} artworkSize={40} action={false} />)}
        </div>
      </section>
    </SkeletonRegion>
  );
}

/* ── Artist profile ────────────────────────────────────────────────────
   Mirrors ArtistProfile.jsx: a 50vh hero with the name overlaid at the bottom,
   then the follow/play/shuffle row, then All Tracks, then albums and related
   artists. */
export function ArtistProfileSkeleton() {
  return (
    <SkeletonRegion label="Loading artist" className="min-h-screen bg-background">
      {/* Hero: same height and minimum as the real screen so the page does not
          grow when the cover arrives. */}
      <div className="relative h-[50vh] min-h-[300px]" aria-hidden="true">
        <Skeleton className="absolute inset-0 w-full h-full" radius="rounded-none" animation="pulse" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        {/* Back affordance occupies its slot without being interactive. */}
        <Skeleton width={40} height={40} radius="9999px" className="absolute top-4 left-6" />
        <div className="absolute bottom-6 left-6 right-6">
          <SkeletonText width={280} height={32} radius="8px" className="mb-2" />
          <SkeletonText width={132} height={14} />
        </div>
      </div>

      {/* Follow / play / shuffle. */}
      <div className="flex items-center gap-4 px-6 py-4" aria-hidden="true">
        <SkeletonButton width={116} height={36} circle />
        <SkeletonButton width={48} height={48} circle />
        <Skeleton width={40} height={40} radius="9999px" className="border border-on-surface/20" />
      </div>

      <div className="px-6 flex flex-col gap-8">
        <section aria-hidden="true">
          <div className="flex items-center justify-between mb-3">
            <SkeletonText width={104} height={18} />
            <SkeletonText width={72} height={11} />
          </div>
          <div className="flex flex-col">
            {Array.from({ length: 6 }, (_, i) => <SkeletonTrackRow key={i} artworkSize={48} />)}
          </div>
        </section>

        <section aria-hidden="true">
          <SkeletonText width={92} height={18} className="mb-3" />
          <SkeletonRail count={5} width={148} />
        </section>

        <section aria-hidden="true">
          <SkeletonText width={118} height={18} className="mb-3" />
          <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="w-[128px] shrink-0 snap-start text-center">
                <Skeleton className="w-full aspect-square rounded-full mb-2.5 border border-border-subtle" />
                <SkeletonText width="76%" height={12} className="mx-auto" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </SkeletonRegion>
  );
}

/* ── Album ─────────────────────────────────────────────────────────────
   Mirrors AlbumDetail.jsx: a centred 224px cover, title/artist/meta beneath,
   then the action row and track list. */
export function AlbumSkeleton() {
  return (
    <SkeletonRegion label="Loading album" className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl flex justify-between items-center px-6 py-4" aria-hidden="true">
        <Skeleton width={24} height={24} radius="6px" />
        <div className="flex items-center gap-3">
          <Skeleton width={24} height={24} radius="6px" />
          <Skeleton width={24} height={24} radius="6px" />
        </div>
      </header>

      <div className="flex flex-col items-center px-6 pt-2">
        {/* Exact cover size from the real screen, so nothing reflows. */}
        <Skeleton width={224} height={224} radius="rounded-3xl" className="mb-6" />
        <SkeletonText width={230} height={24} radius="6px" className="mb-2" />
        <SkeletonText width={150} height={16} className="mb-2" />
        <SkeletonText width={190} height={14} />
      </div>

      <div className="flex items-center gap-4 mt-6 px-6" aria-hidden="true">
        <SkeletonCircle size={24} />
        <SkeletonCircle size={24} />
        <SkeletonButton width={124} height={40} circle />
        <SkeletonCircle size={24} />
      </div>

      <div className="px-6 mt-6 flex flex-col gap-0.5">
        {Array.from({ length: 8 }, (_, i) => <SkeletonTrackRow key={i} artworkSize={44} rank />)}
      </div>
    </SkeletonRegion>
  );
}

/* ── Playlist ──────────────────────────────────────────────────────────
   Playlist artwork beside its title, description and owner, then actions and
   the track list. */
export function PlaylistSkeleton() {
  return (
    <SkeletonRegion label="Loading playlist" className="min-h-screen bg-background">
      <header className="flex items-center gap-4 px-6 py-4" aria-hidden="true">
        <Skeleton width={24} height={24} radius="6px" />
      </header>

      <div className="flex flex-col sm:flex-row items-start gap-5 px-6 pb-6">
        <Skeleton width={168} height={168} radius="rounded-2xl" className="shrink-0" />
        <div className="flex-1 min-w-0 w-full">
          <SkeletonText width={110} height={10} radius="3px" className="mb-2.5" />
          <SkeletonText width="72%" height={30} radius="8px" className="mb-3" />
          <SkeletonLines lines={2} width="88%" className="mb-3" />
          {/* Owner line: avatar slot plus two text lines. */}
          <div className="flex items-center gap-2 mt-3">
            <SkeletonCircle size={26} />
            <div className="flex-1 min-w-0">
              <SkeletonText width={110} height={12} className="mb-1.5" />
              <SkeletonText width={148} height={11} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-6 pb-5" aria-hidden="true">
        <SkeletonButton width={132} height={42} circle />
        <SkeletonCircle size={38} />
        <SkeletonCircle size={38} />
        <SkeletonCircle size={38} />
      </div>

      <div className="px-6 flex flex-col gap-0.5">
        {Array.from({ length: 10 }, (_, i) => <SkeletonTrackRow key={i} artworkSize={48} />)}
      </div>
    </SkeletonRegion>
  );
}

/* ── Library ───────────────────────────────────────────────────────────
   Mirrors YourLibrary's filter chips plus the content for whichever tab is
   active. Rows for the list tabs, a tile grid for Playlists/Albums. */
export function LibrarySkeleton({ tab = 'Songs' }) {
  const isGrid = tab === 'Playlists' || tab === 'Albums' || tab === 'Artists';

  return (
    <SkeletonRegion label="Loading your library" className="flex flex-col gap-5">
      <section aria-hidden="true">
        <SkeletonText width={148} height={26} radius="7px" className="mb-4" />
        <SkeletonText width={92} height={11} className="mb-5" />
      </section>

      {isGrid ? (
        <section aria-hidden="true">
          <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
            {Array.from({ length: 6 }, (_, i) => <SkeletonGridTile key={i} width={148} />)}
          </div>
        </section>
      ) : (
        <section aria-hidden="true">
          <div className="flex flex-col gap-0.5">
            {Array.from({ length: 8 }, (_, i) => <SkeletonTrackRow key={i} artworkSize={48} />)}
          </div>
        </section>
      )}
    </SkeletonRegion>
  );
}

/* ── Charts ────────────────────────────────────────────────────────────
   Mirrors Charts.jsx: a header, the country/tab controls, and a numbered track
   list. The rank slots are present but empty of numbers, so no chart position
   is implied while loading. */
export function ChartsSkeleton() {
  return (
    <SkeletonRegion label="Loading charts" className="flex flex-col gap-5">
      <section aria-hidden="true">
        <SkeletonText width={140} height={26} radius="7px" className="mb-4" />
        <SkeletonText width={190} height={11} className="mb-5" />
        <div className="flex gap-2 mb-5">
          <SkeletonButton width={78} height={30} circle />
          <SkeletonButton width={96} height={30} circle />
          <SkeletonButton width={88} height={30} circle />
        </div>
      </section>

      <section aria-hidden="true">
        {/* `min-w-0` on the text column is what lets the real rows truncate at
            375px. Without it the long provider badge and duration push the row
            wider than the viewport. */}
        <div className="flex flex-col gap-0.5 min-w-0">
          {Array.from({ length: 10 }, (_, i) => <SkeletonTrackRow key={i} artworkSize={48} rank />)}
        </div>
      </section>
    </SkeletonRegion>
  );
}

/* ── Discover ──────────────────────────────────────────────────────────
   Genre tiles and country sections. */
export function DiscoverSkeleton() {
  return (
    <SkeletonRegion label="Loading discovery" className="flex flex-col gap-7">
      <section aria-hidden="true">
        <SkeletonText width={150} height={26} radius="7px" className="mb-4" />
      </section>

      <section aria-hidden="true">
        <SkeletonText width={132} height={18} className="mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="border border-border-subtle rounded-2xl px-3 py-3.5">
              <Skeleton width={18} height={18} radius="4px" className="mb-2" />
              <SkeletonText width="64%" height={12} />
            </div>
          ))}
        </div>
      </section>

      <section aria-hidden="true">
        <SkeletonText width={164} height={18} className="mb-3" />
        <SkeletonRail count={6} />
      </section>
    </SkeletonRegion>
  );
}

/* ── Profile ───────────────────────────────────────────────────────────
   Mirrors UserProfile: avatar, display name, username, stats row, then the
   profile action and content sections. */
export function ProfileSkeleton() {
  return (
    <SkeletonRegion label="Loading profile" className="flex flex-col gap-6">
      <section className="flex flex-col items-center sm:flex-row sm:items-start gap-5" aria-hidden="true">
        <SkeletonCircle size={112} />
        <div className="flex-1 min-w-0 w-full text-center sm:text-left">
          <SkeletonText width={210} height={26} radius="7px" className="mb-2.5 mx-auto sm:mx-0" />
          <SkeletonText width={148} height={14} className="mb-4 mx-auto sm:mx-0" />
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <SkeletonButton width={132} height={36} circle />
            <SkeletonButton width={104} height={36} circle />
          </div>
        </div>
      </section>

      {/* Stat tiles. */}
      <section aria-hidden="true">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-2xl border border-border-subtle px-3 py-3.5 text-center">
              <Skeleton width={44} height={18} radius="5px" className="mx-auto mb-2" />
              <SkeletonText width={62} height={10} className="mx-auto" />
            </div>
          ))}
        </div>
      </section>

      <section aria-hidden="true">
        <SkeletonText width={142} height={18} className="mb-3" />
        <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCircle key={i} size={96} />)}
        </div>
      </section>

      <section aria-hidden="true">
        <SkeletonText width={158} height={18} className="mb-3" />
        <div className="flex flex-col gap-0.5">
          {Array.from({ length: 4 }, (_, i) => <SkeletonTrackRow key={i} artworkSize={48} />)}
        </div>
      </section>
    </SkeletonRegion>
  );
}

/* ── Now Playing ───────────────────────────────────────────────────────
   Only the fields that are genuinely missing are skeletonised. Callers pass
   `fields` listing which parts are unresolved; anything already known (a title
   that arrived before its artwork, say) stays visible, so the skeleton never
   replaces information the listener already has.
 *
 * Purely presentational and non-interactive: it contains no buttons, so it
 * cannot intercept a click meant for the transport controls. */
export function NowPlayingSkeleton({ fields = { artwork: true, title: true, artist: true, progress: true, controls: true } }) {
  return (
    <div className="flex flex-col items-center gap-6" aria-hidden="true">
      {fields.artwork && <Skeleton className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px]" radius="rounded-3xl" />}

      <div className="w-full max-w-[560px] px-6 flex flex-col items-center gap-2">
        {fields.title && <SkeletonText width="62%" height={24} radius="6px" />}
        {fields.artist && <SkeletonText width={168} height={14} />}
      </div>

      {fields.progress && (
        <div className="w-full max-w-[560px] px-6 flex flex-col gap-2">
          <Skeleton className="w-full h-1" radius="9999px" />
          <div className="flex justify-between">
            <SkeletonText width={34} height={10} />
            <SkeletonText width={34} height={10} />
          </div>
        </div>
      )}

      {fields.controls && (
        <div className="flex items-center gap-7">
          <SkeletonCircle size={26} />
          <SkeletonCircle size={44} />
          <SkeletonCircle size={26} />
        </div>
      )}
    </div>
  );
}

/* ── MiniPlayer ────────────────────────────────────────────────────────
   Placeholder for a track whose metadata or artwork is still resolving. It
   keeps the bar's height so the player does not collapse and re-expand, and it
   is inert: no controls, so it cannot swallow a transport click. */
export function MiniPlayerSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 h-full" aria-hidden="true">
      <Skeleton width={44} height={44} radius="rounded-lg" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <SkeletonText width="58%" height={12} className="mb-1.5" />
        <SkeletonText width="38%" height={10} />
      </div>
      <div className="hidden sm:flex items-center gap-3 shrink-0">
        <SkeletonCircle size={22} />
        <SkeletonCircle size={22} />
      </div>
    </div>
  );
}
