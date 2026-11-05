/**
 * Home skeleton.
 *
 * Mirrors the real Home layout section for section, using the same container
 * widths, grid columns and rail geometry as src/screens/Home.jsx so the page
 * does not shift when the data lands:
 *
 *   greeting + subtitle -> primary/secondary CTAs -> Quick Picks (2/3 cols)
 *   -> "Made for You" rail -> Recently Played -> Popular Artists
 *   -> Trending Music -> Top in <country> -> Rising Now
 *   -> Top Charts (numbered rows) -> Artists You Should Know (circles)
 *   -> Browse Genres (2/3/4 cols)
 *
 * No titles, artist names or counts are invented: every placeholder is a shape
 * sized like the content it stands in for.
 */
import {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonImage,
  SkeletonButton,
  SkeletonRegion,
  SkeletonRail,
} from './Skeleton';

/** One square track card with its two text lines. */
function SkeletonTrackCard({ width = 172 }) {
  return (
    <div className="shrink-0 snap-start" style={{ width }} aria-hidden="true">
      <Skeleton className="w-full aspect-square mb-2.5" radius="rounded-2xl" />
      <SkeletonText width="88%" height={13} className="mb-1.5" />
      <SkeletonText width="62%" height={11} />
    </div>
  );
}

/** One numbered row, as used by the Top Charts list. */
function SkeletonChartRow() {
  return (
    <div className="w-full flex items-center gap-3 p-2" aria-hidden="true">
      {/* Rank number: a narrow bar, so no position is implied. */}
      <Skeleton width={12} height={12} radius="3px" className="shrink-0" />
      <Skeleton className="w-10 h-10 shrink-0" radius="rounded-lg" />
      <div className="flex-1 min-w-0">
        <SkeletonText width="58%" height={13} className="mb-1.5" />
        <SkeletonText width="38%" height={11} />
      </div>
      <SkeletonCircle size={22} />
    </div>
  );
}

/** One circular artist tile. */
function SkeletonArtistCircle({ width = 128 }) {
  return (
    <div className="shrink-0 snap-start text-center" style={{ width }} aria-hidden="true">
      <Skeleton className="w-full aspect-square rounded-full mb-2.5 border border-border-subtle" />
      <SkeletonText width="78%" height={12} className="mx-auto" />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <SkeletonRegion label="Loading your home feed" className="flex flex-col gap-7">
      {/* Greeting and actions. Text widths follow the real headline sizes. */}
      <section aria-hidden="true">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <SkeletonText width={260} height={30} radius="8px" className="mb-2.5" />
            <SkeletonText width={200} height={14} />
          </div>
          <div className="flex items-center gap-2">
            <SkeletonButton width={148} height={40} circle />
            <SkeletonButton width={104} height={40} circle />
          </div>
        </div>
      </section>

      {/* Quick Picks: 2 columns on mobile, 3 from sm up. */}
      <section aria-hidden="true">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 px-3.5 py-3.5 flex items-center gap-2.5">
              <Skeleton width={20} height={20} radius="5px" />
              <SkeletonText width="62%" height={12} />
            </div>
          ))}
        </div>
      </section>

      <section aria-hidden="true">
        <SkeletonText width={150} height={18} className="mb-3" />
        <SkeletonRail count={5} />
      </section>

      <section aria-hidden="true">
        <SkeletonText width={168} height={18} className="mb-3" />
        <SkeletonRail count={5} />
      </section>

      <section aria-hidden="true">
        <SkeletonText width={148} height={18} className="mb-3" />
        <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="w-[148px] shrink-0 snap-start">
              <Skeleton className="w-full aspect-square mb-2.5" radius="rounded-2xl" />
              <SkeletonText width="70%" height={12} />
            </div>
          ))}
        </div>
      </section>

      <section aria-hidden="true">
        <SkeletonText width={158} height={18} className="mb-3" />
        <SkeletonRail count={6} />
      </section>

      <section aria-hidden="true">
        <SkeletonText width={140} height={18} className="mb-3" />
        <SkeletonRail count={6} />
      </section>

      <section aria-hidden="true">
        <SkeletonText width={134} height={18} className="mb-3" />
        <SkeletonRail count={6} />
      </section>

      {/* Top Charts: a stacked list of rows. */}
      <section aria-hidden="true">
        <SkeletonText width={116} height={18} className="mb-3" />
        <div className="space-y-0.5">
          {Array.from({ length: 6 }, (_, i) => <SkeletonChartRow key={i} />)}
        </div>
      </section>

      <section aria-hidden="true">
        <SkeletonText width={198} height={18} className="mb-3" />
        <div className="flex gap-3.5 overflow-x-auto hide-scrollbar snap-x pb-1">
          {Array.from({ length: 6 }, (_, i) => <SkeletonArtistCircle key={i} />)}
        </div>
      </section>

      <section aria-hidden="true">
        <SkeletonText width={136} height={18} className="mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="border border-border-subtle rounded-2xl px-3 py-3.5">
              <Skeleton width={18} height={18} radius="4px" className="mb-2" />
              <SkeletonText width="66%" height={12} />
            </div>
          ))}
        </div>
      </section>
    </SkeletonRegion>
  );
}

export default HomeSkeleton;