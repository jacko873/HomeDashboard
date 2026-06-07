interface BackgroundArtProps {
  artworkUrl?: string;
}

/**
 * Fullscreen blurred album-art backdrop with a dark overlay.
 * The image is keyed by URL so a new track cross-fades in via CSS animation
 * instead of hard-swapping.
 */
export function BackgroundArt({ artworkUrl }: BackgroundArtProps) {
  return (
    <div className="background-art" aria-hidden="true">
      {artworkUrl && (
        <img
          key={artworkUrl}
          className="background-art__image"
          src={artworkUrl}
          alt=""
          draggable={false}
        />
      )}
      <div className="background-art__overlay" />
    </div>
  );
}
