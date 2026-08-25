import { useEffect, useRef, type CSSProperties } from 'react';
import type { DraftAnalytics, Player } from '@/services/auctionDraftService';
import { getIdentity, teamColors, teamLogo } from '@/services/nflIdentity';
import { Headshot } from './Headshot';

interface PlayerProfileProps {
  player: Player;
  analytics: DraftAnalytics | null;
  onClose: () => void;
}

const feetInches = (inches: number | null): string =>
  inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : '—';

const money = (value: number | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `$${Math.round(value)}` : '—';

export const PlayerProfile = ({ player, analytics, onClose }: PlayerProfileProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const identity = getIdentity(player.id);
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const facts: Array<[string, string]> = [
    ['Position', player.position],
    ['Team', team],
    ['Jersey', identity?.jersey ? `#${identity.jersey}` : '—'],
    ['Age', identity?.age ? `${identity.age}` : '—'],
    ['Height', feetInches(identity?.heightInches ?? null)],
    ['Weight', identity?.weightPounds ? `${identity.weightPounds} lb` : '—'],
    ['College', identity?.college ?? '—'],
    ['Experience', identity?.experience != null ? `${identity.experience} yr` : '—'],
  ];

  const valuation: Array<[string, string]> = [
    ['List value', `$${player.estimatedValue}`],
    ['Opening bid', money(analytics?.openingBid)],
    ['Target', money(analytics?.targetBid)],
    ['Max bid', money(analytics?.maxBid)],
    ['Walk away', money(analytics?.walkAwayPoint)],
    ['VORP', `${player.valueOverReplacement}`],
    ['Floor / ceiling', `${player.floor} – ${player.upside}`],
    ['Bye week', `${player.byeWeek}`],
  ];

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label={`${player.name} profile`}>
      <button
        type="button"
        className="dr-modal-scrim"
        aria-label="Close profile"
        onClick={onClose}
      />

      <article className="dr-modal-panel" style={{ '--dr-accent': primary } as CSSProperties}>
        <header className="dr-stage-hero">
          {logo && <img className="dr-stage-logo" src={logo} alt="" aria-hidden="true" />}
          <Headshot
            identity={identity}
            fallbackName={player.name}
            width={208}
            className="dr-stage-photo"
          />
          <div>
            <h2 className="dr-stage-name">{identity?.name ?? player.name}</h2>
            <p className="dr-stage-sub">
              <span className="dr-pos">{player.position}</span>
              {team}
              {identity?.status && identity.status !== 'Active' && (
                <span style={{ color: 'var(--dr-caution)' }}>{identity.status}</span>
              )}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="dr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {identity?.injury?.status && (
          <p className="dr-notice" style={{ margin: 14 }}>
            Injury report: {identity.injury.status}
            {identity.injury.detail ? ` — ${identity.injury.detail}` : ''}
          </p>
        )}

        {identity && identity.confidence !== 'exact' && (
          <p className="dr-notice dr-notice-warn" style={{ margin: 14 }}>
            Roster mismatch: {identity.note ?? 'this entry did not match ESPN exactly'}. Shown data
            comes from ESPN; the draft pool's own numbers may be out of date.
          </p>
        )}

        <section className="dr-modal-section">
          <h3 className="dr-eyebrow">Player</h3>
          <dl className="dr-facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="dr-modal-section">
          <h3 className="dr-eyebrow">Valuation</h3>
          <dl className="dr-facts">
            {valuation.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="dr-modal-section">
          <h3 className="dr-eyebrow">Risk</h3>
          <dl className="dr-facts">
            <div>
              <dt>Injury risk</dt>
              <dd>{player.injuryRisk}</dd>
            </div>
            <div>
              <dt>Age risk</dt>
              <dd>{player.ageRisk}</dd>
            </div>
            <div>
              <dt>Consistency</dt>
              <dd>{player.consistency}/10</dd>
            </div>
            <div>
              <dt>Competition</dt>
              <dd>{player.competitionLevel.replace(/_/g, ' ').toLowerCase()}</dd>
            </div>
          </dl>
        </section>
      </article>
    </div>
  );
};
