import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

/** Top-level route segments the app owns (see routes.tsx). */
const ROUTE_SEGMENTS = /\/(music|status|debug)(?:\/.*)?$/;

/**
 * Detects the path the app is mounted under at runtime, so the router works
 * both at the domain root (the TV) and behind path-prefixing proxies such as
 * code-server's /proxy/<port>/ during development.
 */
function detectBasename(): string {
  const { pathname } = window.location;
  const match = ROUTE_SEGMENTS.exec(pathname);
  // On a known route: everything before it is the mount path.
  // Otherwise (e.g. landing on the mount root itself): the whole path.
  const base = match ? pathname.slice(0, match.index) : pathname.replace(/\/+$/, '');
  return base || '/';
}

const router = createBrowserRouter(routes, { basename: detectBasename() });

export function App() {
  return <RouterProvider router={router} />;
}
