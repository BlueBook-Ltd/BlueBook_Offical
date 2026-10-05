# Design versions

Canonical site: `bluebook-cohere/` (https://www.bluebook.blue).

## v2 — Figma WhatsApp landing + chrome (current)

- **Date:** 13 Sep 2026
- **Source:** [Figma file `BsWitd0lSwM1FtZF5wyITq`](https://www.figma.com/design/BsWitd0lSwM1FtZF5wyITq/Untitled?node-id=305-30&m=dev), node `305:30`
- **What changed:** Site header, site footer, and `/en/services/whatsapp-ai-agent/` rebuilt to match that frame
- **Assets:** `public/images/figma-wa/`

## v1 — Cohere chrome (archived)

- **Backup path:** [`archive/design-v1-cohere-2026-09-13/`](archive/design-v1-cohere-2026-09-13/)
- **Git restore point:** commit `293b500` on branch `cursor/whatsapp-ai-agent-seo-redesign` (local git; no GitHub remote at archive time)
- **What it was:** Sticky 64px header with JetBrains Mono uppercase links; black two-column footer plus Get In Touch banner; Notion-style WhatsApp marketing page

To restore v1 chrome without git:

```text
copy archive/design-v1-cohere-2026-09-13/components/* → src/components/
copy archive/design-v1-cohere-2026-09-13/styles/site-*.css → src/styles/components/
copy archive/design-v1-cohere-2026-09-13/routes/Whatsapp-ai-agentPage.tsx → src/routes/en/services/
```
