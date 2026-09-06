import { animated, useInView, useTrail } from '@react-spring/web';
import { Link } from 'react-router-dom';
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
} from 'react';
import { prefersReducedMotion, springReveal } from './springConfig';

export const AnimatedLink = animated(Link);

export function useClearMotionPending(selector = '[data-motion-pending]') {
  useEffect(() => {
    const clear = () => {
      document.querySelectorAll(selector).forEach((el) => {
        el.removeAttribute('data-motion-pending');
      });
    };
    // Let first paint apply CSS hide gate, then springs take over
    const t = window.setTimeout(clear, 30);
    return () => clearTimeout(t);
  }, [selector]);
}

type StaggerProps = {
  children: ReactNode;
  delay?: number;
  fromY?: number;
  itemClassName?: string;
};

export function SpringStagger({
  children,
  delay = 70,
  fromY = 32,
  itemClassName,
}: StaggerProps) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const reduced = prefersReducedMotion();
  const trail = useTrail(items.length, {
    from: { opacity: reduced ? 1 : 0, y: reduced ? 0 : fromY },
    to: { opacity: 1, y: 0 },
    config: springReveal,
    delay: reduced ? 0 : delay,
  });

  return (
    <>
      {trail.map((style, i) => (
        <animated.div key={items[i].key ?? i} className={itemClassName} style={style}>
          {items[i]}
        </animated.div>
      ))}
    </>
  );
}

type InViewLinkProps = {
  to: string;
  className?: string;
  children: ReactNode;
  fromY?: number;
  delay?: number;
};

/** react-router Link with spring reveal — keeps CSS selectors on the <a>. */
export function SpringLink({
  to,
  className,
  children,
  fromY = 28,
  delay = 0,
}: InViewLinkProps) {
  const reduced = prefersReducedMotion();
  const [ref, springs] = useInView(
    () => ({
      from: { opacity: reduced ? 1 : 0, y: reduced ? 0 : fromY },
      to: { opacity: 1, y: 0 },
      delay: reduced ? 0 : delay,
      config: springReveal,
    }),
    { once: true, rootMargin: '-6% 0px -10% 0px', amount: 0.15 },
  );

  return (
    <AnimatedLink ref={ref as never} to={to} className={className} style={springs}>
      {children}
    </AnimatedLink>
  );
}
