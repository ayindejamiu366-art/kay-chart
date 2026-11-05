import { memo } from 'react';

/**
 * Skeleton primitives.
 *
 * One base element plus a few named shapes, so every loading state in Nocturne
 * is built from the same handful of pieces and the animation, accessibility
 * and reduced-motion behaviour are defined once.
 *
 * Design rules this file follows:
 *
 * - **Structural, never semantic.** Nothing here invents a song title, an
 *   artist name or a follower count. A skeleton is a shape, not content, so a
 *   screen reader never announces placeholder text as though it were real.
 * - **Reserve the final box.** Dimensions mirror the loaded component so the
 *   layout does not shift when data arrives.
 * - **CSS only.** The sweep is a composited transform/background-position on a
 *   pseudo-element, so a screen full of skeletons does not run per-node
 *   JavaScript. No animation library is involved.
 * - **Respect prefers-reduced-motion.** `usePrefersReducedMotion` is read once
 *   per render rather than per node, and any skeleton rendered after the user
 *   changes the OS setting picks it up.
 */

const ANIMATIONS = new Set(['shimmer', 'pulse', 'none']);

/**
 * True when the user has asked for reduced motion.
 *
 * Uses `matchMedia` rather than a one-shot read so the value is still correct if
 * the setting changes after first paint.
 */
function usePrefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Resolve the animation attribute.
 *
 * An explicit `animation` prop wins unless reduced motion is on, in which case
 * the skeleton becomes static regardless. That ordering means a caller can ask
 * for `shimmer` but never accidentally force motion on someone who opted out.
 */
function resolveAnimation(animation, reduced) {
  if (reduced) return 'none';
  if (ANIMATIONS.has(animation)) return animation;
  return 'shimmer';
}

/**
 * The base skeleton block.
 *
 * Renders a non-semantic element by default. `as` exists for the rare case where
 * a parent expects a specific child (a heading inside a list, say), but the
 * default is a `span`, because a skeleton is not real content and should not
 * add a heading, list item or paragraph to the accessibility tree.
 *
 * @param {object} props
 * @param {string|number} [props.width]  CSS width. Numbers are treated as px.
 * @param {string|number} [props.height] CSS height. Numbers are treated as px.
 * @param {string} [props.radius]        Any CSS border-radius value.
 * @param {string} [props.className]
 * @param {'shimmer'|'pulse'|'none'} [props.animation]
 * @param {boolean} [props.reducedMotion] Force the reduced-motion treatment.
 * @param {boolean} [props.as]           Element to render (default 'span').
 */
function Skeleton({
  width,
  height,
  radius,
  className = '',
  animation = 'shimmer',
  reducedMotion,
  as: Tag = 'span',
  style,
  ...rest
}) {
  const systemReduced = usePrefersReducedMotion();
  const reduced = reducedMotion === undefined ? systemReduced : reducedMotion;
  const resolved = resolveAnimation(animation, reduced);

  // Numbers are pixels; anything else is passed through as CSS so callers can
  // use percentages, rem, or calc() for responsive sizing.
  const toCss = (v) => (typeof v === 'number' ? `${v}px` : v);

  return (
    <Tag
      aria-hidden="true"
      data-skeleton=""
      data-animation={resolved}
      data-static={reduced ? 'true' : undefined}
      className={`skeleton block ${className}`.trim()}
      style={{
        width: toCss(width),
        height: toCss(height),
        borderRadius: radius,
        ...style,
      }}
      {...rest}
    />
  );
}

/** A line of text. `size` maps to the type scale used across the app. */
function SkeletonText({ width = '100%', height, size = 'sm', className = '', ...rest }) {
  const heights = { xs: 11, sm: 14, md: 16, lg: 20, xl: 24 };
  return (
    <Skeleton
      width={width}
      height={height ?? heights[size] ?? heights.sm}
      radius={Math.round((heights[size] ?? heights.sm) / 3)}
      className={className}
      {...rest}
    />
  );
}

/** A circular placeholder, for artist avatars and round artwork. */
function SkeletonCircle({ size = 40, className = '', ...rest }) {
  return <Skeleton width={size} height={size} radius="9999px" className={`shrink-0 ${className}`.trim()} {...rest} />;
}

/**
 * A square artwork placeholder.
 *
 * `ratio` accepts the tailwind aspect utilities the app already uses, so a
 * skeleton can sit in the same container as the real cover and inherit its
 * sizing rather than duplicating a magic number.
 */
function SkeletonImage({ ratio = 'aspect-square', className = '', radius = 'rounded-2xl', ...rest }) {
  return (
    <div className={`relative w-full ${ratio} overflow-hidden shrink-0 ${className}`.trim()}>
      <Skeleton className="absolute inset-0 w-full h-full" radius={radius} {...rest} />
    </div>
  );
}

/** A pill or circular button placeholder, sized like the real control. */
function SkeletonButton({ width = 120, height = 40, circle = false, className = '', ...rest }) {
  return (
    <Skeleton
      width={width}
      height={height}
      radius={circle ? '9999px' : Math.round(Number(height) / 2.4)}
      className={`shrink-0 ${className}`.trim()}
      {...rest}
    />
  );
}

/**
 * A card shell.
 *
 * Only reserves the surface; the caller decides what goes inside so a card can
 * mirror a track, an artist or an album without this file knowing about any of
 * them.
 */
function SkeletonCard({ className = '', radius = 'rounded-2xl', children, ...rest }) {
  return (
    <div className={`relative ${radius} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

/**
 * A group of text lines that reads as a paragraph.
 *
 * `lines` controls how many; the final line is shortened by CSS so the block
 * does not look like a filled rectangle. No words are invented.
 */
function SkeletonLines({ lines = 3, width = '100%', size = 'sm', gap = 8, className = '', ...rest }) {
  return (
    <div className={`skeleton-lines ${className}`.trim()} style={{ gap }} aria-hidden="true">
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <SkeletonText key={i} width={i === lines - 1 && lines > 1 ? '62%' : width} size={size} {...rest} />
      ))}
    </div>
  );
}

/**
 * A section shell: a heading placeholder plus a body slot.
 *
 * Screens are built from titled sections, so this mirrors that shape and lets a
 * screen skeleton reserve the vertical rhythm of each section before its content
 * exists. `titleWidth` keeps the heading placeholder short, as headings are.
 */
function SkeletonSection({ titleWidth = 160, children, className = '', bodyClassName = '' }) {
  return (
    <section className={className} aria-hidden="true">
      <SkeletonText width={titleWidth} height={18} className="mb-3" />
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/**
 * The a11y wrapper for a loading region.
 *
 * A screen reader should be told once that content is arriving, not once per
 * placeholder, so the skeleton tree is hidden and this single live region
 * carries the message. Pass the real section name ("Popular Artists") so the
 * announcement is useful rather than generic.
 *
 * @param {string} label What is loading. Announced to assistive technology.
 */
function SkeletonRegion({ label = 'Loading content', children, className = '' }) {
  return (
    <div className={className} role="status" aria-busy="true" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A horizontal rail of skeleton cards, matching the app's scroll-snap rails. */
function SkeletonRail({ count = 5, width = 172, gap = 'gap-3.5', className = '', itemClassName = '' }) {
  return (
    <div className={`flex ${gap} overflow-x-auto hide-scrollbar snap-x pb-1 ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        // Width goes through `style` rather than an arbitrary tailwind value,
        // because `w-[${width}px]` is assembled at runtime and Tailwind cannot
        // see it when it scans for class names.
        <div key={i} className={`shrink-0 snap-start ${itemClassName}`.trim()} style={{ width }}>
          <Skeleton className="w-full aspect-square mb-2.5" radius="rounded-2xl" />
          <SkeletonText width="85%" height={13} className="mb-1.5" />
          <SkeletonText width="60%" height={11} />
        </div>
      ))}
    </div>
  );
}

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
};

export default memo(Skeleton);