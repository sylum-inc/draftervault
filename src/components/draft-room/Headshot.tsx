import { useState } from 'react';
import { headshotUrl, type PlayerIdentity } from '@/services/nflIdentity';

interface HeadshotProps {
  identity?: PlayerIdentity;
  /** Shown when there is no identity, or the image fails to load. */
  fallbackName: string;
  width: number;
  className: string;
}

const initials = (name: string): string =>
  name
    .replace(/[^A-Za-z .]/g, '')
    .split(/[.\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/**
 * A player's face, with a typographic fallback.
 *
 * Headshots come from ESPN's CDN, which is a third party: it can be blocked by
 * a network, missing for a given player, or unreachable offline. None of those
 * should leave a hole in the card, so a monogram takes over instead.
 */
export const Headshot = ({ identity, fallbackName, width, className }: HeadshotProps) => {
  const [failed, setFailed] = useState(false);

  if (!identity?.espnId || failed) {
    return (
      <div className={`${className} dr-card-monogram`} aria-hidden="true">
        {initials(fallbackName)}
      </div>
    );
  }

  return (
    <img
      className={className}
      src={headshotUrl(identity, width)}
      alt=""
      loading="lazy"
      decoding="async"
      width={width}
      height={Math.round(width * 0.73)}
      onError={() => setFailed(true)}
    />
  );
};
