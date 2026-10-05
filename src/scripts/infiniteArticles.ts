type Card = {
  slug: string;
  image?: string;
  tag: string;
  date?: string;
  title: string;
  summary?: string;
  readTime?: number;
};

type Mode = "list" | "related";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function listItemHtml(card: Card, basePath: string) {
  const href = `${basePath}${card.slug}/`;
  const img = card.image
    ? `<img src="${escapeHtml(card.image)}" alt="" width="320" height="240" loading="lazy" decoding="async" />`
    : `<span class="insights__thumb-ph">${escapeHtml(card.tag)}</span>`;
  return `<a class="insights__item" href="${escapeHtml(href)}">
    <div class="insights__thumb">${img}</div>
    <div class="insights__item-body">
      <div class="insights__meta"><span>${escapeHtml(card.tag)}</span><i></i><time>${escapeHtml(card.date ?? "")}</time></div>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.summary ?? "")}</p>
      <div class="insights__foot"><span>Read Time: ${card.readTime ?? 5} min</span><img src="/assets/figma/insights/arrow.svg" alt="" width="16" height="16" /></div>
    </div>
  </a>`;
}

function relatedItemHtml(card: Card, basePath: string) {
  const href = `${basePath}${card.slug}/`;
  const img = card.image
    ? `<img src="${escapeHtml(card.image)}" alt="" width="320" height="200" loading="lazy" decoding="async" />`
    : "";
  return `<a class="nd-more__card" href="${escapeHtml(href)}">
    ${img ? `<span class="nd-more__media">${img}</span>` : ""}
    <span class="nd-more__meta">${escapeHtml(card.tag)}${card.date ? ` · ${escapeHtml(card.date)}` : ""}</span>
    <strong>${escapeHtml(card.title)}</strong>
  </a>`;
}

function bootRoot(root: HTMLElement) {
  const feed = root.querySelector<HTMLElement>("[data-infinite-feed]");
  const sentinel = root.querySelector<HTMLElement>("[data-infinite-sentinel]");
  const status = root.querySelector<HTMLElement>("[data-infinite-status]");
  if (!feed || !sentinel) return;

  const raw = root.getAttribute("data-infinite-items");
  const basePath = root.getAttribute("data-infinite-base") ?? "/en/news/";
  const mode = (root.getAttribute("data-infinite-mode") as Mode) || "list";
  const pageSize = Number(root.getAttribute("data-infinite-page-size") || 3);
  let offset = Number(root.getAttribute("data-infinite-offset") || 0);

  let items: Card[] = [];
  try {
    items = raw ? (JSON.parse(raw) as Card[]) : [];
  } catch {
    items = [];
  }

  let loading = false;
  let done = offset >= items.length;

  const setStatus = (text: string) => {
    if (status) status.textContent = text;
  };

  const append = () => {
    if (loading || done) return;
    loading = true;
    setStatus("Loading…");
    const slice = items.slice(offset, offset + pageSize);
    offset += slice.length;
    const html = slice
      .map((card) => (mode === "related" ? relatedItemHtml(card, basePath) : listItemHtml(card, basePath)))
      .join("");
    const before = feed.children.length;
    feed.insertAdjacentHTML("beforeend", html);
    const nodes = Array.from(feed.children).slice(before) as HTMLElement[];
    if (nodes.length) {
      root.dispatchEvent(
        new CustomEvent("bb:infinite-append", { bubbles: true, detail: { nodes } }),
      );
    }
    loading = false;
    if (offset >= items.length) {
      done = true;
      setStatus("");
      observer.disconnect();
    } else {
      setStatus("");
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) append();
    },
    { rootMargin: "240px 0px" },
  );
  observer.observe(sentinel);
}

document.querySelectorAll<HTMLElement>("[data-infinite]").forEach(bootRoot);
