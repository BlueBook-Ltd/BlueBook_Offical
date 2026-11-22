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

Deploy the CMS separately from `cms/`:

```bash
cd cms
npm run deploy
```

## CMS

Posts, media, and editing live in **[`cms/`](cms/)** — a separate Worker
(`bluebook-cms`) backed by D1 + R2. This site has no admin UI: old `/backend`
URLs redirect to the homepage. It only ever reads published posts, via
`CMS_ORIGIN` (see `.env.example`; local dev defaults to
`http://localhost:5175`, the CMS project's own dev port).

- Public read API this site proxies: `GET /api/posts`,
  `GET /api/posts/:slug`, and media under `GET /media/*`
- CMS admin UI: `https://cms.bluebook.blue` (deploy target; see
  [`cms/README.md`](cms/README.md) for setup, Access policy, and commands)
- Production: `wrangler.jsonc` already points `CMS_ORIGIN` at
  `https://cms.bluebook.blue`. If you use another hostname, change that var.

### Local CMS

```bash
cd cms
npm install
npm run db:migrate:local
# Copy .dev.vars.example → .dev.vars first, then:
npm run dev
```

The main site's `npm run dev` then proxies to `http://localhost:5175`.

## Design versions

Current chrome and WhatsApp page are **v2** (Figma node `305:30`).

- Version log: [`VERSION.md`](VERSION.md)
- v1 backup (header, footer, previous WhatsApp page): [`archive/design-v1-cohere-2026-09-13/`](archive/design-v1-cohere-2026-09-13/)
- Git restore point for v1: commit `293b500` on `cursor/whatsapp-ai-agent-seo-redesign`

## Do not use

Previous production lived in `archive/bluebook-official/`. That copy is archived. Do not deploy it.

## Transferable package

To copy this site to another machine, unzip `bluebook-cohere-portable-2026-09-19.zip` (sibling of this folder) and follow [`TRANSFER.md`](TRANSFER.md). The zip excludes `node_modules`, `.env`, and build output. The CMS is the nested `cms/` project and needs its own install, D1/R2 bindings, and deploy.

