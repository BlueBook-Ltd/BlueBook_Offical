# Bluebook CMS

Standalone editor for the Bluebook website's **News** and **Culture** posts.
It is a separate Cloudflare Worker (`bluebook-cms`) with a React admin UI, a
D1 posts database, and R2 media storage. The public site never writes here; it
only reads published posts through `CMS_ORIGIN`.

- Admin UI: `https://cms.bluebook.blue` (custom domain configured in
  `wrangler.jsonc`)
- Worker name: `bluebook-cms`
- Database: Cloudflare D1, database `bluebook-cms`, binding `DB`
- Media: Cloudflare R2, bucket `news-and-culture`, binding `MEDIA`
- Public API: `GET /api/posts`, `GET /api/posts/:slug`, `GET /media/*`
- Admin API: `/api/admin/*` (token and/or Cloudflare Access)

## Local development

```bash
cd cms
npm install
```

Create local secrets (PowerShell shown; use `cp` in bash):

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Then run the local D1 migration and start Vite:

```bash
npm run db:migrate:local
npm run dev
```

Open <http://localhost:5175>. The token in `.dev.vars` is
`dev-only-token-change-me` unless you changed it.

Notes:

- `npm run dev` starts Vite with the Cloudflare plugin, so the Worker, D1,
  and R2 bindings all run locally.
- The Worker also creates the `posts` table on first request
  (`ensureSchema`) so a fresh local database still works. Migrations remain
  the production path and the source of truth for schema changes.
- The main site defaults to `CMS_ORIGIN=http://localhost:5175`, so
  `npm run dev` in the repository root will use this CMS automatically.
- Local media is stored under `.wrangler/state` and served from
  `http://localhost:5175/media/...`.

## Production setup

Run these from `cms/` after `wrangler login` (or with
`CLOUDFLARE_API_TOKEN` in the environment).

1. Create the D1 database:

   ```bash
   npm run db:create
   ```

   If `bluebook-cms` already exists (for example, left over from an earlier
   deploy), skip this command and put its existing `database_id` into
   `wrangler.jsonc` instead.

2. Create the R2 bucket:

   ```bash
   npm run media:create
   ```

   If `news-and-culture` already exists, skip this command; the binding in
   `wrangler.jsonc` already points at it.

3. Apply the schema to the remote database:

   ```bash
   npm run db:migrate:remote
   ```

4. Set the admin token:

   ```bash
   npx wrangler secret put ADMIN_TOKEN
   ```

   Use a long random value. This is the token you paste into the login
   screen.

5. Optional but recommended — Cloudflare Access:

   - Zero Trust → Access → Applications → **Add a self-hosted application**
     for `cms.bluebook.blue`.
   - Add an **Allow** policy for the people who should edit content.
   - Set `ACCESS_ALLOWED_EMAILS` to the same addresses (comma-separated),
     as a Worker secret or var. Users admitted by Access then skip the token
     screen; the Worker trusts the Access email header only for these
     addresses.

   If Access protects the whole hostname, the main site's Worker also needs a
   **service token** to read posts and media. Create one in
   Zero Trust → Access → Service Auth, then set these secrets on the main
   `bluebook-website` Worker:

   ```bash
   npx wrangler secret put CMS_ACCESS_CLIENT_ID
   npx wrangler secret put CMS_ACCESS_CLIENT_SECRET
   ```

   Alternative: create a second Access application for
   `cms.bluebook.blue/api/posts*` and `cms.bluebook.blue/media/*` with a
   **Bypass** policy, so the public read paths stay reachable without a
   service token.

6. Deploy:

   ```bash
   npm run deploy
   ```

   The configured route is a custom domain for `cms.bluebook.blue`. If DNS or
   the domain is different, update `routes` in `wrangler.jsonc` before
   deploying. `workers_dev` is disabled so the admin UI is not exposed on a
   `*.workers.dev` URL.

7. Deploy the main site from the repository root. Its `wrangler.jsonc`
   already sets `CMS_ORIGIN=https://cms.bluebook.blue`; change it if you used
   another hostname.

### Production checklist

- [ ] `database_id` replaced in `wrangler.jsonc`
- [ ] `wrangler d1 migrations apply bluebook-cms --remote` succeeded
- [ ] R2 bucket exists and `MEDIA` binding resolves
- [ ] `ADMIN_TOKEN` secret set
- [ ] Access application and `ACCESS_ALLOWED_EMAILS` configured (optional)
- [ ] Main site can reach `/api/posts` (service token or bypass path)
- [ ] `https://cms.bluebook.blue` loads the login screen
- [ ] A published post appears at `https://www.bluebook.blue/en/news/<slug>/`

## Writing posts

**Previewing a draft.** The editor's `Preview` button asks
`POST /api/admin/preview-link` for a signed 30-minute token, then opens
`https://www.bluebook.blue/en/<channel>/<slug>/?preview=<token>`. The site's
Worker relays `GET /api/preview/<slug>` to this CMS, which verifies the
signature (HMAC, keyed by `PREVIEW_SECRET` or `ADMIN_TOKEN`) and returns the
post whatever its status. The page renders with a draft banner and `noindex`.

Editorial rules live in [`CONTENT-STYLE.md`](./CONTENT-STYLE.md): the Culture
column voice, the two lengths (Column and Note), banned phrases, how to handle
numbers and claims, and the publish checklist. Read it before drafting, and run
the checklist against the saved draft before publishing.

Fields map directly to the public `CmsPost` contract used by the website:

| Field | Notes |
|---|---|
| `slug` | Lowercase letters, numbers, hyphens. Fixed after first save. |
| `title` | Required. |
| `excerpt` | Listing summary and meta description. |
| `content` | Markdoc source. |
| `channels` | `news`, `culture`, or both. |
| `publishDate` | `YYYY-MM-DD`. Drafts may omit it. |
| `draft` | Drafts are never returned by the public API. |
| `featured` | Featured posts sort first in the channel listing. |
| `readTime` | Minutes; optional. |
| `ratio` | Thumbnail aspect ratio such as `4 / 3`. |
| `tags` | First tag is used as the card label. |
| `coverImage` | Absolute URL or `/media/...` path. |

Markdoc embeds use the same tags as the website:

```md
{% figure src="/media/2026/11/example.png" alt="What the image shows" /%}
{% video src="/media/2026/11/example.mp4" alt="What the video shows" /%}
```

Media URLs are stored as relative `/media/...` paths. The CMS serves them
directly, and the main site's Worker proxies `/media/*` to the CMS, so the
same URL works on both hostnames.

## API

Public (no auth; only published, non-future posts):

- `GET /api/posts?channel=news|culture`
- `GET /api/posts/:slug`
- `GET /media/:key`
- `GET /api/health`

Admin (`Authorization: Bearer <ADMIN_TOKEN>` or Cloudflare Access email):

- `GET /api/admin/session`
- `GET /api/admin/posts`
- `GET /api/admin/posts/:slug`
- `POST /api/admin/posts`
- `PUT /api/admin/posts/:slug`
- `DELETE /api/admin/posts/:slug`
- `GET /api/admin/media?cursor=...`
- `POST /api/admin/media` (`multipart/form-data`, field `file`)
- `DELETE /api/admin/media/:key`

## Notes

- Uploads are limited to images/videos up to 25 MB.
- `workers_dev` is disabled; remove the `routes` entry only if you
  intentionally want a `*.workers.dev` URL instead.
- The admin UI is a hash-routed SPA (`#/posts`, `#/media`), so the Worker's
  asset fallback serves `index.html` for unknown paths.
- Keep `src/markdoc.ts` in sync with the main site's
  `src/cms/markdown.ts` if you add new Markdoc tags.
