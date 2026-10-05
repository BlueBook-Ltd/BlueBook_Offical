/**
 * Stable ids for article headings, shared by the renderer and the contents list.
 *
 * Keeps letters and numbers in any script, so a Chinese heading still gets a
 * usable id instead of collapsing to an empty string.
 */
export function headingId(text: string, taken: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section';

  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  taken.add(id);
  return id;
}

const HEADING_TAG = /<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi;

/**
 * Adds an id to every h2/h3 in a rendered HTML string.
 *
 * This has to happen in the HTML rather than by setting element.id after mount:
 * the body is injected with dangerouslySetInnerHTML, so React rewrites those
 * nodes on any re-render and would drop ids assigned imperatively — leaving the
 * contents list pointing at anchors that no longer exist.
 */
export function addHeadingIds(html: string): string {
  const taken = new Set<string>();

  // Respect ids the author already wrote, so we never hand out a duplicate.
  for (const match of html.matchAll(/\bid=["']([^"']+)["']/g)) {
    if (match[1]) taken.add(match[1]);
  }

  return html.replace(HEADING_TAG, (whole, tag: string, attrs: string, inner: string) => {
    if (/\bid\s*=/i.test(attrs)) return whole;
    const text = inner.replace(/<[^>]*>/g, '').trim();
    if (!text) return whole;
    return `<${tag}${attrs} id="${headingId(text, taken)}">${inner}</${tag}>`;
  });
}
