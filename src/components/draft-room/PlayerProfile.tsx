import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { DraftAnalytics, Player } from '@/services/auctionDraftService';
import {
  getIdentity,
  loadDefenseUnits,
  teamColors,
  teamLogo,
  type DefenseUnits,
} from '@/services/nflIdentity';
import { loadPlayerHistory, type PlayerSeason } from '@/services/playerHistory';
import { Headshot } from './Headshot';
import { Sparkline } from './Sparkline';

interface PlayerProfileProps {
  player: Player;
  analytics: DraftAnalytics | null;
  onClose: () => void;
}

const money = (value: number | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `$${Math.round(value)}` : '—';

/** Which season columns are worth showing depends on what the player does. */
const statColumns = (position: string): Array<[string, (season: PlayerSeason) => string]> => {
  if (position === 'QB') {
    return [
      ['Pass yds', (s) => `${s.passingYards}`],
      ['Pass TD', (s) => `${s.passingTds}`],
      ['Int', (s) => `${s.interceptions}`],
      ['Rush yds', (s) => `${s.rushingYards}`],
    ];
  }
  if (position === 'RB') {
    return [
      ['Carries', (s) => `${s.carries}`],
      ['Rush yds', (s) => `${s.rushingYards}`],
      ['Rec', (s) => `${s.receptions}`],
      ['TD', (s) => `${s.rushingTds + s.receivingTds}`],
    ];
  }
  return [
    ['Targets', (s) => `${s.targets}`],
    ['Rec', (s) => `${s.receptions}`],
    ['Yds', (s) => `${s.receivingYards}`],
    ['Tgt share', (s) => (s.targetShare != null ? `${s.targetShare}%` : '—')],
  ];
};

export const PlayerProfile = ({ player, analytics, onClose }: PlayerProfileProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [history, setHistory] = useState<PlayerSeason[] | null>(null);
  const [defense, setDefense] = useState<DefenseUnits | null>(null);

  const identity = getIdentity(player.id);
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);
  const isDefense = player.position === 'DST';

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Both of these live in lazily loaded files, so a profile opens immediately
  // and fills in rather than blocking on data most sessions never ask for.
  useEffect(() => {
    let live = true;
    if (isDefense) {
      void loadDefenseUnits(team).then((units) => live && setDefense(units ?? null));
    } else {
      void loadPlayerHistory(player.id).then((seasons) => live && setHistory(seasons));
    }
    return () => {
      live = false;
    };
  }, [player.id, team, isDefense]);

  const latest = history?.[history.length - 1];
  const columns = statColumns(player.position);

  const valuation: Array<[string, string]> = [
    ['List value', `$${player.estimatedValue}`],
    ['Opening bid', money(analytics?.openingBid)],
    ['Target', money(analytics?.targetBid)],
    ['Max bid', money(analytics?.maxBid)],
    ['Walk away', money(analytics?.walkAwayPoint)],
    ['VORP', `${player.valueOverReplacement}`],
    ['Floor / ceiling', `${player.floor} – ${player.upside}`],
    ['Bye week', player.byeWeek ? `${player.byeWeek}` : '—'],
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
          {isDefense && logo ? (
            <img className="dr-stage-photo dr-crest-photo" src={logo} alt="" aria-hidden="true" />
          ) : (
            <Headshot
              identity={identity}
              fallbackName={player.name}
              width={208}
              className="dr-stage-photo"
            />
          )}
          <div>
            <h2 className="dr-stage-name">{identity?.name ?? player.name}</h2>
            <p className="dr-stage-sub">
              <span className="dr-pos">{player.position}</span>
              {team}
              {identity?.jersey && <span className="dr-num">#{identity.jersey}</span>}
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

        {!isDefense && (
          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">
              {latest ? `${latest.season} season, game by game` : 'Production'}
            </h3>

            {history === null && <p className="dr-empty">Loading three seasons…</p>}

            {history?.length === 0 && (
              <p className="dr-empty">
                No regular-season tape in the last three years. The projection comes from draft
                capital instead — see the basis in the valuation below.
              </p>
            )}

            {latest && latest.weekly.length > 1 && (
              <Sparkline
                values={latest.weekly}
                label={`${player.name}: PPR points in each ${latest.season} game`}
              />
            )}

            {history && history.length > 0 && (
              <div className="dr-table-wrap" style={{ marginTop: 10 }}>
                <table className="dr-table dr-table-compact">
                  <thead>
                    <tr>
                      <th scope="col">Season</th>
                      <th scope="col" className="is-numeric">
                        Tm
                      </th>
                      <th scope="col" className="is-numeric">
                        G
                      </th>
                      <th scope="col" className="is-numeric">
                        PPG
                      </th>
                      {columns.map(([label]) => (
                        <th key={label} scope="col" className="is-numeric">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((season) => (
                      <tr key={season.season}>
                        <td className="dr-num">{season.season}</td>
                        <td className="is-numeric">{season.team}</td>
                        <td className="is-numeric dr-num">{season.games}</td>
                        <td className="is-numeric dr-num" style={{ color: 'var(--dr-ink)' }}>
                          {season.pointsPerGame}
                        </td>
                        {columns.map(([label, read]) => (
                          <td key={label} className="is-numeric dr-num">
                            {read(season)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {isDefense && (
          <section className="dr-modal-section">
            <h3 className="dr-eyebrow">2025 defensive production</h3>
            <dl className="dr-facts">
              <div>
                <dt>Sacks</dt>
                <dd>{player.defense?.sacks ?? '—'}</dd>
              </div>
              <div>
                <dt>Interceptions</dt>
                <dd>{player.defense?.interceptions ?? '—'}</dd>
              </div>
              <div>
                <dt>Fumbles recovered</dt>
                <dd>{player.defense?.fumbleRecoveries ?? '—'}</dd>
              </div>
              <div>
                <dt>Touchdowns</dt>
                <dd>{player.defense?.touchdowns ?? '—'}</dd>
              </div>
              <div>
                <dt>Points allowed / game</dt>
                <dd>{player.defense?.pointsAllowedPerGame ?? '—'}</dd>
              </div>
            </dl>

            <h3 className="dr-eyebrow" style={{ marginTop: 16 }}>
              Defensive personnel
            </h3>
            {defense === null && <p className="dr-empty">Loading the unit…</p>}
            {defense && (
              <div className="dr-units">
                {(
                  [
                    ['Line', defense.dl],
                    ['Linebackers', defense.lb],
                    ['Secondary', defense.db],
                  ] as const
                ).map(([label, unit]) => (
                  <div className="dr-unit" key={label}>
                    <h4 className="dr-eyebrow">{label}</h4>
                    <ul>
                      {unit.map((person) => (
                        <li key={person.espnId}>
                          <span className="dr-unit-pos dr-num">{person.position}</span>
                          {person.name}
                          {person.jersey && (
                            <span className="dr-unit-jersey dr-num">#{person.jersey}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <p className="dr-footnote">
              Personnel come from the current ESPN roster, ordered by jersey number — which stands
              in for a depth chart the feed does not publish.
            </p>
          </section>
        )}

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
          <h3 className="dr-eyebrow">Player</h3>
          <dl className="dr-facts">
            <div>
              <dt>Age</dt>
              <dd>{identity?.age ?? '—'}</dd>
            </div>
            <div>
              <dt>Experience</dt>
              <dd>{identity?.experience != null ? `${identity.experience} yr` : '—'}</dd>
            </div>
            <div>
              <dt>College</dt>
              <dd>{identity?.college ?? '—'}</dd>
            </div>
            <div>
              <dt>Snap share</dt>
              <dd>
                {player.snapPercentage != null ? `${Math.round(player.snapPercentage)}%` : '—'}
              </dd>
            </div>
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
              <dd>{player.consistency ?? '—'}/10</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{player.competitionLevel.replace(/_/g, ' ').toLowerCase()}</dd>
            </div>
          </dl>
        </section>
      </article>
    </div>
  );
};
