# Transfer this folder

This archive is the canonical Bluebook site (`bluebook-cohere`), without `node_modules`, build output, or `.env` secrets.

## Unpack

1. Unzip into a folder named `bluebook-cohere`.
2. Copy `.env.example` to `.env` and `.dev.vars`, then set `CMS_ORIGIN` to your bluebook-cms deployment (and Resend keys if you use the contact form).
3. Install and run:

```bash
npm install
npm run dev
```

News and Culture pages read from the CMS at `CMS_ORIGIN`. There's no admin
UI on this site — editing happens on the standalone bluebook-cms
deployment, behind Cloudflare Access.

Deploy from this folder with `npm run deploy` (Cloudflare Worker `bluebook-website`).

## Left out on purpose

- `node_modules/`
- `dist/`, `.wrangler/`
- `.env` and `.dev.vars` (secrets). Use `.env.example`.
- `blender/`, `city-app/`, `_oversized/`
