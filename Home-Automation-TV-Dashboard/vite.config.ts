import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Listen on all interfaces so the dev server is reachable through a
      // remote/container port-forward, not just localhost.
      host: true,
      // Vite 6 rejects requests whose Host header isn't localhost ("Blocked
      // request. This host is not allowed."). That breaks access via VS Code /
      // code-server forwarded URLs and tunnel domains (*.devtunnels.ms, etc.),
      // so allow any host in dev. Override with VITE_ALLOWED_HOSTS (comma list).
      allowedHosts: process.env.VITE_ALLOWED_HOSTS
        ? process.env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim())
        : (true as const),
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy API calls to the Go backend in local dev so the frontend can use
      // relative `/api/…` URLs (same as behind nginx in production). Override
      // the target with VITE_DEV_API_PROXY, e.g. http://music-api.home.arpa:8080.
      proxy: {
        '/api': {
          target: process.env.VITE_DEV_API_PROXY ?? 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
