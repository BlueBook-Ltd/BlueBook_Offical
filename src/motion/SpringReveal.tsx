import {
  animated,
  useInView,
  type AnimatedProps,
} from '@react-spring/web';
import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from 'react';
import { prefersReducedMotion, springReveal } from './springConfig';

type RevealProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
  fromY?: number;
  fromX?: number;
  fromScale?: number;
  delay?: number;
  once?: boolean;
  rootMargin?: string;
  amount?: number | 'any' | 'all';
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'ref'>;

/**
 * Physics reveal when the node enters the viewport.
 */
export function SpringReveal<T extends ElementType = 'div'>({
  as,
  children,
  fromY = 36,
  fromX = 0,
  fromScale = 1,
  delay = 0,
  once = true,
  rootMargin = '-8% 0px -12% 0px',
  amount = 0.2,
  className,
  style,
  ...rest
}: RevealProps<T>) {
  const Comp = (as ? animated[as as 'div'] : animated.div) as ElementType;
  const reduced = prefersReducedMotion();

  const [ref, springs] = useInView(
    () => ({
      from: {
        opacity: reduced ? 1 : 0,
        y: reduced ? 0 : fromY,
        x: reduced ? 0 : fromX,
        scale: reduced ? 1 : fromScale,
      },
      to: { opacity: 1, y: 0, x: 0, scale: 1 },
      delay: reduced ? 0 : delay,
      config: springReveal,
    }),
    { once, rootMargin, amount },
  );

  return (
    <Comp
      ref={ref}
      className={className}
      style={{ ...(style as object), ...springs } as AnimatedProps<'div'>['style']}
      {...rest}
    >
      {children}
    </Comp>
  );
}
