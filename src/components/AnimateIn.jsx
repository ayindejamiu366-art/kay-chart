import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { prefersReduced } from '../utils/gsap';

export default function AnimateIn({
  children,
  delay = 0,
  y = 24,
  x = 0,
  scale = 1,
  opacity = 0,
  duration = 0.6,
  ease = 'power3.out',
  stagger = 0,
  className = '',
  style = {},
  as = 'div',
  ...props
}) {
  const ref = useRef(null);
  const Tag = as;

  useGSAP(() => {
    if (!ref.current || prefersReduced) {
      if (ref.current) gsap.set(ref.current, { opacity: 1, y: 0, x: 0, scale: 1 });
      return;
    }

    const targets = stagger ? ref.current.children : ref.current;
    if (!targets || (stagger && !targets.length)) return;

    gsap.from(targets, {
      opacity,
      y,
      x,
      scale: scale !== 1 ? scale : undefined,
      duration,
      delay,
      stagger: stagger || undefined,
      ease,
      overwrite: 'auto',
      clearProps: 'transform',
    });
  }, { scope: ref, dependencies: [delay, stagger] });

  return (
    <Tag ref={ref} className={className} style={style} {...props}>
      {children}
    </Tag>
  );
}
