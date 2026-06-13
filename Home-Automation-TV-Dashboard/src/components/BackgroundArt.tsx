interface BackgroundArtProps {
  artworkUrl?: string;
}

/**
 * Fullscreen blurred album-art backdrop with a dark overlay.
 * The image is keyed by URL so a new track cross-fades in via CSS animation
 * instead of hard-swapping. Sits behind the dashboard content (z-index 0)
 * while the foreground panels render above it.
 */
export default function BackgroundArt({ artworkUrl }: BackgroundArtProps) {
  return (
    <div className="background-art" aria-hidden="true">
      {artworkUrl && (
        <img
          key={artworkUrl}
          className="background-art__image"
          src={artworkUrl}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
        />
      )}
      <div className="background-art__overlay" />
    </div>
  );
}
