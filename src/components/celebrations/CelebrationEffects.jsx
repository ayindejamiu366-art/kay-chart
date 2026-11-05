import { memo } from 'react';
import { prefersReduced } from '../../utils/gsap';
import {
  buildParticles,
  themeStyle,
  CELEBRATION_CSS,
} from '../../celebrations/celebration-themes';

/**
 * Ambient celebration layer.
 *
 * Deliberately non-interactive and low in the stacking order:
 *  - `pointer-events-none` so it can never swallow a tap on playback or nav.
 *  - sits behind content (z-0) and never covers album artwork.
 *  - no canvas and no requestAnimationFrame; particles are CSS-animated divs, so
 *    the browser can throttle them and React never re-renders during animation.
 *
 * With reduced motion the particles are omitted entirely and only a static
 * gradient wash remains.
 */
function CelebrationEffects({ theme, active }) {
  if (!active) return null;

  const themeName = theme || 'festive';
  const reduced = prefersReduced;
  const particles = buildParticles(themeName, { reducedMotion: reduced });

  return (
    <>
      <style>{CELEBRATION_CSS}</style>

      {/* Ambient wash. Static under reduced motion. */}
      <div
        aria-hidden="true"
        className="celebration-layer pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={themeStyle(themeName)}
      >
        <div
          className="celebration-ambience"
          style={{
            background:
              'radial-gradient(120% 70% at 12% -8%, color-mix(in srgb, var(--celeb-accent) 12%, transparent), transparent 62%),'
              + 'radial-gradient(90% 60% at 92% 4%, color-mix(in srgb, var(--celeb-secondary) 10%, transparent), transparent 60%)',
            animation: reduced ? 'none' : 'celeb-pulse-soft 14s ease-in-out infinite',
          }}
        />

        {/* Top edge accent — a thin premium line rather than a banner. */}
        <div
          className="celebration-edge"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--celeb-accent), var(--celeb-secondary), transparent)',
            opacity: reduced ? 0.5 : 0.7,
          }}
        />

        {!reduced && particles.map(p => (
          <span
            key={p.key}
            aria-hidden="true"
            className={`celebration-particle celebration-particle--${p.variant} absolute bottom-0`}
            style={{
              left: p.left,
              // Standard CSS properties only — React sets these by name. The
              // per-variant appearance comes from the class, never from a spread.
              width: p.width,
              height: p.height,
              opacity: p.opacity,
              animationName: p.variant === 'ember' || p.variant === 'spark' ? 'celeb-rise' : 'celeb-fall',
              animationDuration: p.duration,
              animationDelay: p.delay,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
              '--celeb-drift': p.drift,
              '--celeb-particle-opacity': p.opacity,
            }}
          />
        ))}
      </div>
    </>
  );
}

export default memo(CelebrationEffects);