import { Navigate, type RouteObject } from 'react-router-dom';
import { Debug } from '../pages/Debug';
import { MusicNowPlaying } from '../pages/MusicNowPlaying';
import { Status } from '../pages/Status';

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/music" replace /> },
  { path: '/music', element: <MusicNowPlaying /> },
  { path: '/status', element: <Status /> },
  { path: '/debug', element: <Debug /> },
  // Unknown routes fall back to the music dashboard.
  { path: '*', element: <Navigate to="/music" replace /> },
];
