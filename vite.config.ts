import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  envPrefix: ['VITE_', 'PUBLIC_'],
  resolve: {
    alias: { '@': resolve(root, 'src') },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    assetsDir: 'assets',
  },
});
