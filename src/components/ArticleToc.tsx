import { useCallback, useEffect, useState, type MouseEvent, type RefObject } from 'react';
import { headingId } from '@/utils/headingId';

interface Props {
  /** The element holding the article body. Headings are read out of it. */
  containerRef: RefObject<HTMLElement | null>;
  /** Re-scan when this changes — normally the article slug. */
  watch?: unknown;
  title?: string;
}

interface Heading {
  id: string;
  label: string;
  level: 2 | 3;
}

/**
 * Section navigation for an article. Reads the headings out of the rendered
 * body rather than taking a hardcoded list, so it works for CMS markdown and
 * hand-written sections alike. Renders nothing when there is less than two
 * headings — a contents list of one entry is just noise.
 */
export default function ArticleToc({ containerRef, watch, title = 'CONTENTS' }: Props) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const scan = () => {
      const taken = new Set<string>();
      const found: Heading[] = [];

      root.querySelectorAll<HTMLElement>('h2, h3').forEach((el) => {
        const label = (el.textContent ?? '').trim();
        if (!label) return;
        // CMS bodies arrive with ids already baked into the HTML; this only
        // covers hand-written sections that have none.
        if (el.id) taken.add(el.id);
        else el.id = headingId(label, taken);
        found.push({ id: el.id, label, level: el.tagName === 'H3' ? 3 : 2 });
      });

      setHeadings((prev) => {
        const same =
          prev.length === found.length &&
          prev.every((h, i) => h.id === found[i]?.id && h.label === found[i]?.label);
        return same ? prev : found;
      });
      setActiveId((prev) => (found.some((h) => h.id === prev) ? prev : found[0]?.id ?? ''));
    };

    scan();

    // Article bodies can land after this runs — CMS content is fetched, and
    // React may replace the injected HTML on a later render.
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [containerRef, watch]);

  useEffect(() => {
    if (headings.length < 2) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      // A heading counts as "reached" once it passes the upper third of the
      // viewport, which tracks reading position better than the very top.
      const line = window.innerHeight * 0.3;
      let current = headings[0]?.id ?? '';
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = heading.id;
        else break;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [headings]);

  const jumpTo = useCallback((event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
    // Update the address bar without the browser also jumping.
    try {
      history.replaceState(null, '', `#${id}`);
    } catch {
      /* ignore */
    }
  }, []);

  if (headings.length < 2) return null;

  return (
    <aside className="nd__sidebar">
      <h2 className="nd__sidebar-title">{title}</h2>
      <nav className="nd__toc" aria-label="Article sections">
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <a
              key={heading.id}
              className={[
                'nd__toc-link',
                heading.level === 3 ? 'nd__toc-link--sub' : '',
                active ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              href={`#${heading.id}`}
              aria-current={active ? 'true' : undefined}
              onClick={(event) => jumpTo(event, heading.id)}
            >
              <span className="nd__toc-bar" />
              {heading.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
