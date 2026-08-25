import { useEffect, useState } from 'react';
import type { Player, Team } from '@/services/auctionDraftService';

interface NominationClockProps {
  /** Who is up to nominate. */
  nominator: Team | undefined;
  /** The player currently on the block; the clock runs only while one is up. */
  player: Player | null;
  seconds: number;
}

/**
 * Time on the player currently up for auction.
 *
 * It runs down and then sits at zero rather than acting on its own: an auction
 * ends when the room stops bidding, and a timer that sold players by itself
 * would be wrong more often than useful. The clock is a prompt, not a referee.
 */
export const NominationClock = ({ nominator, player, seconds }: NominationClockProps) => {
  const [remaining, setRemaining] = useState(seconds);

  // Restart whenever a different player takes the block.
  useEffect(() => {
    setRemaining(seconds);
    if (!player || seconds <= 0) return undefined;
    const tick = setInterval(() => {
      setRemaining((current) => (current <= 0 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [player?.id, seconds, player]);

  if (!nominator) return null;

  const running = Boolean(player) && seconds > 0;
  const urgent = running && remaining <= 5;

  return (
    <div className="dr-clock" data-urgent={urgent || undefined}>
      <span className="dr-eyebrow">{player ? 'On the block' : 'Nominating'}</span>
      <span className="dr-clock-team">{nominator.name}</span>
      {running && (
        <span className="dr-clock-time dr-num" role="timer" aria-live="off">
          {String(Math.floor(remaining / 60)).padStart(1, '0')}:
          {String(remaining % 60).padStart(2, '0')}
        </span>
      )}
    </div>
  );
};
