# Bluebook website (canonical)

This folder is the **only official Bluebook website**.

- Live: https://www.bluebook.blue
- Cloudflare Worker: `bluebook-website` (account `bluebybook@outlook.com`)
- Stack: **React 19 + Vite + React Router** on Cloudflare Workers, reading content from a standalone CMS

## Commands

```bash
npm run dev
npm run deploy
```

`npm run deploy` builds the React site, then `wrangler deploy`.

## CMS

Posts, media, and editing all live on **bluebook-cms**, a separate Worker
deployment gated by Cloudflare Access — this site has no admin UI or
password login anymore. It only ever reads published posts, via
`CMS_ORIGIN` (see `.env.example`; local dev defaults to
`http://localhost:5175`, the `cms` project's own dev port).

- Public read API this site proxies: `GET /api/posts`, `GET /api/posts/:slug`
- To run bluebook-cms locally, or to publish/edit content, see the `cms`
  project's own README (sibling folder).

## Design versions

Current chrome and WhatsApp page are **v2** (Figma node `305:30`).

- Version log: [`VERSION.md`](VERSION.md)
- v1 backup (header, footer, previous WhatsApp page): [`archive/design-v1-cohere-2026-09-13/`](archive/design-v1-cohere-2026-09-13/)
- Git restore point for v1: commit `293b500` on `cursor/whatsapp-ai-agent-seo-redesign`

## Do not use

Previous production lived in `archive/bluebook-official/`. That copy is archived. Do not deploy it.

## Transferable package

To copy this site to another machine, unzip `bluebook-cohere-portable-2026-09-19.zip` (sibling of this folder) and follow [`TRANSFER.md`](TRANSFER.md). The zip excludes `node_modules`, `.env`, and build output.

