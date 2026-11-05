/**
 * Barrel for the skeleton system.
 *
 * Import from `@/components/skeleton` (or a relative path) rather than reaching
 * into individual files, so the set stays coherent.
 */
export {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonImage,
  SkeletonButton,
  SkeletonCard,
  SkeletonLines,
  SkeletonSection,
  SkeletonRegion,
  SkeletonRail,
  usePrefersReducedMotion,
} from './Skeleton';

export {
  SkeletonTrackRow,
  SkeletonArtistResultRow,
  SkeletonAlbumRow,
  SkeletonGridTile,
  SkeletonTrackList,
  SkeletonLibraryList,
} from './rows';

export { HomeSkeleton } from './HomeSkeleton';

export {
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
} from './screens';
