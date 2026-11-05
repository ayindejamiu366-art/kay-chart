import { CELEBRATION_THEMES, DEFAULT_THEME } from './celebration-config';

/**
 * Resolve a theme key to its presentation values, falling back safely.
 * Unknown keys can only ever produce the default theme, so a provider value
 * that is not a real theme name cannot inject styling.
 */
export function getTheme(themeKey) {
  return CELEBRATION_THEMES[themeKey] || CELEBRATION_THEMES[DEFAULT_THEME];
}

/**
 * CSS custom properties for a celebration.
 *
 * Values come only from CELEBRATION_THEMES, never from provider data, and are
 * applied via a style object with fixed property names — so no externally
 * supplied string is ever interpreted as CSS.
 */
export function themeStyle(themeKey) {
  const theme = getTheme(themeKey);
  return {
    '--celeb-accent': theme.accent,
    '--celeb-secondary': theme.secondary,
    '--celeb-glow': theme.glow,
  };
}

/**
 * Particle budget per intensity. Themes state an intensity; the actual count is
 * derived here so no theme can quietly request hundreds of elements, and so
 * multiple overlapping celebrations can be combined without the total exploding.
 */
const INTENSITY_SCALE = {
  subtle: 0,
  restrained: 0.55,
  expressive: 1,
};

export function particleCountFor(themeKey, { reducedMotion = false } = {}) {
  if (reducedMotion) return 0;
  const theme = getTheme(themeKey);
  const scale = INTENSITY_SCALE[theme.intensity] ?? INTENSITY_SCALE.restrained;
  return Math.max(0, Math.min(Math.round(theme.particleCount * scale), 30));
}

/**
 * Deterministic particle field.
 *
 * Positions are derived from the particle index rather than Math.random at
 * render time, so React renders stay pure and a re-render never reshuffles the
 * effect. No canvas and no requestAnimationFrame: these are CSS-animated divs,
 * which keeps the cost flat and lets the browser pause them off-screen.
 */
export function buildParticles(themeKey, { reducedMotion = false } = {}) {
  const theme = getTheme(themeKey);
  const count = particleCountFor(themeKey, { reducedMotion });

  return Array.from({ length: count }, (_, i) => {
    // Two irrational multipliers spread the values without clustering.
    const x = ((i * 37) % 100);
    const drift = ((i * 53) % 60) - 30;
    const size = 3 + ((i * 7) % 5);
    const duration = 11 + ((i * 13) % 10);
    const delay = (i * 1.7) % duration;
    // Confetti is a thin rectangle; everything else is a small square-ish dot.
    const isConfetti = theme.particle === 'confetti';
    const isHeart = theme.particle === 'heart';

    return {
      key: `${themeKey}-${i}`,
      left: `${x}%`,
      width: isConfetti ? '3px' : (isHeart ? '9px' : `${size}px`),
      height: isConfetti ? '8px' : (isHeart ? '9px' : `${size}px`),
      duration: `${duration}s`,
      delay: `-${delay}s`,
      drift: `${drift}px`,
      opacity: 0.18 + ((i * 11) % 30) / 100,
      variant: theme.particle,
    };
  });
}

/**
 * Per-variant particle appearance, as CSS rules rather than inline style.
 *
 * These used to be CSS declaration strings spread into a React `style` object,
 * which throws ("Failed to set an indexed property on 'CSSStyleDeclaration'")
 * because React sets style properties by name, not by index. They are now real
 * rules, and the component applies geometry inline plus a variant class.
 *
 * Shapes stay abstract and small so the effect reads as ambience, not clip-art.
 */
export const PARTICLE_VARIANTS = ['snow', 'spark', 'ember', 'heart', 'petal', 'confetti', 'star'];

export const CELEBRATION_CSS = `
@keyframes celeb-fall {
  0%   { transform: translate3d(0, -12vh, 0) rotate(0deg); opacity: 0; }
  10%  { opacity: var(--celeb-particle-opacity, 0.3); }
  100% { transform: translate3d(var(--celeb-drift, 10px), 104vh, 0) rotate(360deg); opacity: 0; }
}
@keyframes celeb-rise {
  0%   { transform: translate3d(0, 104vh, 0) rotate(0deg); opacity: 0; }
  12%  { opacity: var(--celeb-particle-opacity, 0.3); }
  100% { transform: translate3d(var(--celeb-drift, -10px), -12vh, 0) rotate(320deg); opacity: 0; }
}
@keyframes celeb-pulse-soft {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50%      { opacity: 0.6; transform: scale(1.06); }
}

/* Snow */
.celebration-particle--snow {
  border-radius: 9999px;
  background: var(--celeb-accent);
}
/* Spark */
.celebration-particle--spark {
  border-radius: 9999px;
  background: var(--celeb-secondary);
  box-shadow: 0 0 6px var(--celeb-secondary);
}
/* Ember */
.celebration-particle--ember {
  border-radius: 9999px;
  background: var(--celeb-secondary);
  box-shadow: 0 0 8px var(--celeb-accent);
}
/* Heart */
.celebration-particle--heart {
  width: 9px;
  height: 9px;
  background: var(--celeb-accent);
  transform: rotate(-45deg);
  border-radius: 2px;
}
/* Petal */
.celebration-particle--petal {
  border-radius: 50% 0 50% 50%;
  background: var(--celeb-secondary);
}
/* Confetti */
.celebration-particle--confetti {
  width: 3px;
  height: 8px;
  border-radius: 1px;
  background: var(--celeb-accent);
}
/* Star */
.celebration-particle--star {
  border-radius: 9999px;
  background: var(--celeb-accent);
  box-shadow: 0 0 7px var(--celeb-secondary);
}
`;