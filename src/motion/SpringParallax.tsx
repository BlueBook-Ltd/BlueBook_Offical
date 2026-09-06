import { animated, useScroll, to } from '@react-spring/web';
import { type CSSProperties, type ReactNode, useRef } from 'react';
import { prefersReducedMotion, springParallax } from './springConfig';

type Props = {
  children: ReactNode;
  /** Max translate in px at section edges (positive = moves opposite scroll). */
  distance?: number;
  className?: string;
  style?: CSSProperties;
  as?: 'div' | 'span' | 'img' | 'section';
};

/**
 * Scroll-linked parallax with spring lag — content trails the scroll slightly.
 */
export function SpringParallax({
  children,
  distance = 48,
  className,
  style,
  as = 'div',
}: Props) {
  const localRef = useRef<HTMLElement | null>(null);
  const reduced = prefersReducedMotion();
  const { scrollY } = useScroll({
    config: springParallax,
  });

  const Tag = animated[as];

  const y = reduced
    ? 0
    : to(scrollY, (sy) => {
        const el = localRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        // Progress of element mid-point through viewport (-1..1-ish)
        const mid = rect.top + rect.height / 2;
        const viewMid = window.innerHeight / 2;
        const t = (mid - viewMid) / window.innerHeight;
        return Math.max(-distance, Math.min(distance, t * distance));
      });

  return (
    <Tag
      ref={localRef as never}
      className={className}
      style={{
        ...style,
        y,
        willChange: reduced ? undefined : 'transform',
      }}
    >
      {children}
    </Tag>
  );
}
