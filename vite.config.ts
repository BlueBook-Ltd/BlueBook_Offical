import { createReadStream, existsSync, statSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { dirname, extname, resolve, sep } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

const TOY_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
};

/**
 * `/toys/` playground. The site runs behind the Cloudflare plugin with
 * `run_worker_first`, so the worker answers every request and a folder in the
 * repo root would never be served. This serves `toys/` at `/toys/` during
 * `vite dev` only — experiments stay out of the production build.
 */
function toysFolder(): Plugin {
  const dir = resolve(root, 'toys');

  return {
    name: 'bluebook-toys',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/toys', (req, res, next) => {
        const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
        let file = resolve(dir, `.${pathname}`);

        if (file !== dir && !file.startsWith(dir + sep)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, 'index.html');
        if (!existsSync(file)) {
          next();
          return;
        }

        res.setHeader('Content-Type', TOY_MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), toysFolder(), cloudflare()],
  envPrefix: ['VITE_', 'PUBLIC_'],
  resolve: {
    alias: { '@': resolve(root, 'src') },
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/react-router(?:-dom)?|@remix-run/.test(id)) return 'react-router';
          if (/[\\/]react[\\/]|[\\/]react-dom[\\/]|[\\/]scheduler[\\/]/.test(id)) return 'react-vendor';
        },
      },
    },
  },
});
