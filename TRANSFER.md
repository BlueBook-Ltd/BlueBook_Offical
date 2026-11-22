# Transfer this folder

This archive is the canonical Bluebook site (`bluebook-cohere`), without `node_modules`, build output, or `.env` secrets.

## Unpack

1. Unzip into a folder named `bluebook-cohere`.
2. Copy `.env.example` to `.env` and `.dev.vars`, then set `CMS_ORIGIN` to your CMS deployment (and Resend keys if you use the contact form).
3. Install and run:

```bash
npm install
npm run dev
```

News and Culture pages read from the CMS at `CMS_ORIGIN`. There's no admin
UI on this site — editing happens in the nested `cms/` Worker
(`bluebook-cms`), which also holds the D1 posts database and R2 media.

Deploy from this folder with `npm run deploy` (Cloudflare Worker `bluebook-website`).

## CMS

```bash
cd cms
npm install
npm run db:migrate:local   # after creating D1 for the first time
npm run dev                # http://localhost:5175
```

See [`cms/README.md`](cms/README.md) for production D1/R2 setup, secrets,
Cloudflare Access, and deploy. Deploy the CMS before the main site so
`CMS_ORIGIN` resolves.

## Left out on purpose

- `node_modules/`
- `dist/`, `.wrangler/`
- `.env` and `.dev.vars` (secrets). Use `.env.example` and `cms/.dev.vars.example`.
- `cms/node_modules/`, `cms/dist/`, `cms/.wrangler/`
- `blender/`, `city-app/`, `_oversized/`
