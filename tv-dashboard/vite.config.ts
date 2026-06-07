import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev-only: code-server's /proxy/<port>/ strips the path prefix before
 * forwarding, but the browser still resolves Vite's absolute module URLs
 * (e.g. /src/main.tsx) against the domain root. Fix: serve dev under the
 * full browser-visible prefix (base), and restore that prefix on incoming
 * requests since the proxy already removed it. Direct (unproxied) access
 * keeps working too — prefixed and unprefixed requests are both accepted.
 */
function restoreProxyPrefix(prefix: string): PluginOption {
  return {
    name: 'restore-proxy-prefix',
    apply: 'serve',
    configureServer(server) {
      const restore = (req: { url?: string }) => {
        if (req.url && !req.url.startsWith(`${prefix}/`)) {
          req.url = prefix + req.url
        }
      }
      // Regular requests…
      server.middlewares.use((req, _res, next) => {
        restore(req)
        next()
      })
      // …and the HMR websocket upgrade, which bypasses connect middlewares.
      // prependListener runs before Vite's own upgrade handler.
      server.httpServer?.prependListener('upgrade', restore)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Full path prefix the browser sees when the DEV server runs behind a
  // path-stripping proxy (set it in .env, see .env.example). Dev-only;
  // builds always use a relative base.
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyBase = (env.DEV_PROXY_BASE ?? '').replace(/\/+$/, '')

  return {
    plugins: [react(), devProxyBase ? restoreProxyPrefix(devProxyBase) : null],
    // Relative base so the built app works at any mount path (e.g. behind a
    // path-stripping proxy like code-server's /proxy/<port>/). All routes are
    // single-segment (/music, /status, /debug), so relative URLs stay correct.
    // Dev needs an absolute base — '/' or the proxy prefix (see above).
    base: command === 'build' ? './' : devProxyBase ? `${devProxyBase}/` : '/',
    server: {
      host: true, // bind 0.0.0.0 so proxies (Coder/code-server) can reach it
      port: 5173,
      allowedHosts: true, // proxied requests arrive with the proxy's Host header
    },
    preview: {
      host: true,
      port: 4173,
      allowedHosts: true,
    },
  }
})
