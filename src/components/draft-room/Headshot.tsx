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
 * A player's face, with a typographic fallback that is always underneath it.
 *
 * Headshots come from ESPN's CDN, which is a third party: it can be blocked by
 * a network, missing for a given player, unreachable offline, or — the case
 * that was actually found — swallowed by a service worker whose fetch never
 * settles, so the image sits `complete: false` for the whole night and no
 * `error` event ever fires. The first version of this component rendered the
 * monogram *only* on error, and on a sixty-card board driven with the CDN
 * unreachable it rendered zero monograms: sixty empty rings, on the one element
 * whose job is telling you who was just called.
 *
 * So the monogram is not a branch, it is a layer. It is always in the DOM under
 * the image; a photo that arrives paints over it, and one that never arrives —
 * for any reason, including reasons that fire no event — leaves it showing.
 * `onError` still hides the broken image outright so no broken-image glyph can
 * sit on top of the letters.
 */
export const Headshot = ({ identity, fallbackName, width, className }: HeadshotProps) => {
  const [failed, setFailed] = useState(false);
  const canTry = Boolean(identity?.espnId) && !failed;

  return (
    <span className={`${className} dr-face`} aria-hidden="true">
      <span className="dr-face-mono">{initials(fallbackName)}</span>
      {canTry && (
        <img
          className="dr-face-img"
          src={headshotUrl(identity!, width)}
          alt=""
          loading="lazy"
          decoding="async"
          width={width}
          height={Math.round(width * 0.73)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
};
