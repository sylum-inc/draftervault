import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { DraftAnalytics, Player } from '@/services/auctionDraftService';
import {
  getIdentity,
  loadDefenseUnits,
  teamColors,
  teamLogo,
  type DefenseUnits,
} from '@/services/nflIdentity';
import { loadPlayerHistory, type PlayerSeason } from '@/services/playerHistory';
import { loadSchedule } from '@/services/nflSchedule';
import { Headshot } from './Headshot';
import { Sparkline } from './Sparkline';
import { RangeBar } from './charts/RangeBar';
import { PercentileBars } from './charts/PercentileBars';
import { SeasonMultiples } from './charts/SeasonMultiples';
import { ScheduleStrip, type ScheduleGame } from './charts/ScheduleStrip';
import { BidLadder } from './charts/BidLadder';

interface PlayerProfileProps {
  player: Player;
  analytics: DraftAnalytics | null;
  /** What is typed into the bid box right now, so the ladder can show it. */
  currentBid?: number;
  /** Points a freely available player at this position scores. */
  replacementPoints?: number;
  onClose: () => void;
}

type Tab = 'overview' | 'production' | 'usage' | 'schedule' | 'value' | 'defense';

const money = (value: number | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `$${Math.round(value)}` : '—';

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

/** One sentence on what this player is, assembled from what we actually know. */
const verdict = (player: Player): string => {
  const parts: string[] = [];
  const percentile = player.percentiles?.points;
  if (percentile != null) {
    parts.push(
      percentile >= 90
        ? `A top-ten ${player.position} by our projection`
        : percentile >= 70
          ? `An every-week starter at ${player.position}`
          : percentile >= 40
            ? `A flex-and-bye-week ${player.position}`
            : `Depth at ${player.position}`
    );
  }
  if (player.recentTrends === 'RISING') parts.push('scoring more than last season');
  if (player.recentTrends === 'DECLINING') parts.push('scoring less than last season');
  if (player.injuryRisk === 'HIGH') parts.push('with real availability risk');
  else if ((player.consistency ?? 0) >= 8) parts.push('and unusually steady week to week');
  if (player.competitionLevel === 'COMMITTEE') parts.push('sharing the workload');
  return `${parts.join(', ')}.`;
};

export const PlayerProfile = ({
  player,
  analytics,
  currentBid,
  replacementPoints,
  onClose,
}: PlayerProfileProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [history, setHistory] = useState<PlayerSeason[] | null>(null);
  const [defense, setDefense] = useState<DefenseUnits | null>(null);
  const [schedule, setSchedule] = useState<ScheduleGame[] | null>(null);

  const identity = getIdentity(player.id);
  const team = identity?.team ?? player.team;
  const { primary } = teamColors(team);
  const logo = teamLogo(team);
  const isDefense = player.position === 'DST';

  const tabs: Array<[Tab, string]> = isDefense
    ? [
        ['overview', 'Overview'],
        ['defense', 'Unit'],
        ['schedule', 'Schedule'],
        ['value', 'Value'],
      ]
    : [
        ['overview', 'Overview'],
        ['production', 'Production'],
        ['usage', 'Usage'],
        ['schedule', 'Schedule'],
        ['value', 'Value'],
      ];

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Each of these lives in its own lazily loaded file, fetched the first time a
  // tab needs it so opening a profile never waits on data nobody looks at.
  useEffect(() => {
    let live = true;
    if (isDefense) void loadDefenseUnits(team).then((units) => live && setDefense(units ?? null));
    else void loadPlayerHistory(player.id).then((seasons) => live && setHistory(seasons));
    void loadSchedule(team).then((games) => live && setSchedule(games));
    return () => {
      live = false;
    };
  }, [player.id, team, isDefense]);

  const latest = history?.[history.length - 1];
  const columns = statColumns(player.position);

  const percentileRows = useMemo(() => {
    const p = player.percentiles ?? {};
    const rows: Array<{ label: string; percentile: number; value: string }> = [];
    if (p.points != null)
      rows.push({
        label: 'Projected points',
        percentile: p.points,
        value: `${player.projectedPoints}`,
      });
    if (p.pointsPerGame != null)
      rows.push({
        label: 'Points per game',
        percentile: p.pointsPerGame,
        value: `${(player.projectedPoints / Math.max(1, player.lastSeasonGames || 17)).toFixed(1)}`,
      });
    if (p.ceiling != null)
      rows.push({ label: 'Ceiling', percentile: p.ceiling, value: `${player.upside}` });
    if (p.floor != null)
      rows.push({ label: 'Floor', percentile: p.floor, value: `${player.floor}` });
    if (p.consistency != null)
      rows.push({
        label: 'Consistency',
        percentile: p.consistency,
        value: `${player.consistency}/10`,
      });
    if (p.snapShare != null && player.snapPercentage != null)
      rows.push({
        label: 'Snap share',
        percentile: p.snapShare,
        value: `${Math.round(player.snapPercentage)}%`,
      });
    if (p.targetShare != null && player.targetShare != null)
      rows.push({
        label: 'Target share',
        percentile: p.targetShare,
        value: `${player.targetShare}%`,
      });
    return rows;
  }, [player]);

  return (
    <div className="dr-modal" role="dialog" aria-modal="true" aria-label={`${player.name} profile`}>
      <button
        type="button"
        className="dr-modal-scrim"
        aria-label="Close profile"
        onClick={onClose}
      />

      <article
        className="dr-modal-panel dr-profile"
        style={{ '--dr-accent': primary } as CSSProperties}
      >
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
              {identity?.age && <span className="dr-num">{identity.age}y</span>}
              <span className="dr-num">#{player.adp} overall</span>
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

        <div className="dr-tabs" role="tablist" aria-label="Player detail">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className="dr-tab"
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {identity?.injury?.status && (
          <p className="dr-notice" style={{ margin: '12px 16px 0' }}>
            Injury report: {identity.injury.status}
            {identity.injury.detail ? ` — ${identity.injury.detail}` : ''}
          </p>
        )}

        {tab === 'overview' && (
          <div className="dr-tabpanel" role="tabpanel">
            <dl className="dr-stage-tiles dr-profile-tiles">
              <div className="dr-tile">
                <dt>Value</dt>
                <dd style={{ color: 'var(--dr-value)' }}>${player.estimatedValue}</dd>
              </div>
              <div className="dr-tile">
                <dt>Projected</dt>
                <dd>{player.projectedPoints}</dd>
              </div>
              <div className="dr-tile">
                <dt>VORP</dt>
                <dd>{player.valueOverReplacement}</dd>
              </div>
              <div className="dr-tile">
                <dt>Bye</dt>
                <dd>{player.byeWeek || '—'}</dd>
              </div>
            </dl>

            <p className="dr-verdict-line">{verdict(player)}</p>

            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Likely season</h3>
              <RangeBar
                floor={player.floor}
                projection={player.projectedPoints}
                ceiling={player.upside}
                replacement={replacementPoints}
              />
            </section>

            {percentileRows.length > 0 && (
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">Against the position</h3>
                <PercentileBars rows={percentileRows} position={player.position} />
              </section>
            )}

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
                  <dt>Role</dt>
                  <dd>{player.competitionLevel.replace(/_/g, ' ').toLowerCase()}</dd>
                </div>
                <div>
                  <dt>Trend</dt>
                  <dd>{player.recentTrends.toLowerCase()}</dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {tab === 'production' && (
          <div className="dr-tabpanel" role="tabpanel">
            {history === null && <p className="dr-empty">Loading three seasons…</p>}
            {history?.length === 0 && (
              <p className="dr-empty">
                No regular-season tape in the last three years. The projection comes from what
                players drafted in the same round have historically produced.
              </p>
            )}

            {latest && latest.weekly.length > 1 && (
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">{latest.season} season, game by game</h3>
                <Sparkline
                  values={latest.weekly}
                  label={`${player.name}: PPR points in each ${latest.season} game`}
                  height={72}
                />
              </section>
            )}

            {history && history.length > 1 && (
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">Season on season</h3>
                <SeasonMultiples seasons={history} />
              </section>
            )}

            {history && history.length > 0 && (
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">Totals</h3>
                <div className="dr-table-wrap">
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
                        <th scope="col" className="is-numeric">
                          Points
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
                          <td className="is-numeric dr-num">{Math.round(season.pprPoints)}</td>
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
              </section>
            )}
          </div>
        )}

        {tab === 'usage' && (
          <div className="dr-tabpanel" role="tabpanel">
            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">How he is used</h3>
              <dl className="dr-facts">
                <div>
                  <dt>Snap share</dt>
                  <dd>
                    {player.snapPercentage != null ? `${Math.round(player.snapPercentage)}%` : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Target share</dt>
                  <dd>{player.targetShare != null ? `${player.targetShare}%` : '—'}</dd>
                </div>
                <div>
                  <dt>Games played</dt>
                  <dd>{player.lastSeasonGames ?? '—'}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{player.competitionLevel.replace(/_/g, ' ').toLowerCase()}</dd>
                </div>
              </dl>
            </section>

            {latest && (latest.airYards > 0 || latest.yardsAfterCatch > 0) && (
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">Where the yards come from</h3>
                <div className="dr-split">
                  <span
                    className="dr-split-part"
                    style={{
                      width: `${(latest.airYards / Math.max(1, latest.airYards + latest.yardsAfterCatch)) * 100}%`,
                    }}
                  >
                    <em>Air</em>
                    <strong className="dr-num">{latest.airYards}</strong>
                  </span>
                  <span className="dr-split-part is-secondary">
                    <em>After catch</em>
                    <strong className="dr-num">{latest.yardsAfterCatch}</strong>
                  </span>
                </div>
                <p className="dr-footnote">
                  Air yards are earned before the ball arrives and depend on how a team uses him;
                  yards after the catch are his own.
                </p>
              </section>
            )}

            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Background</h3>
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
                  <dt>Games missed</dt>
                  <dd>
                    {player.injuryRisk === 'LOW' ? 'few or none' : player.injuryRisk.toLowerCase()}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {tab === 'schedule' && (
          <div className="dr-tabpanel" role="tabpanel">
            {schedule === null && <p className="dr-empty">Loading the season…</p>}
            {schedule && schedule.length === 0 && (
              <p className="dr-empty">No schedule published yet.</p>
            )}
            {schedule && schedule.length > 0 && (
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">{team} season</h3>
                <ScheduleStrip games={schedule} byeWeek={player.byeWeek ?? null} />
              </section>
            )}
          </div>
        )}

        {tab === 'defense' && (
          <div className="dr-tabpanel" role="tabpanel">
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
            </section>

            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">Defensive personnel</h3>
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
          </div>
        )}

        {tab === 'value' && (
          <div className="dr-tabpanel" role="tabpanel">
            {analytics && (
              <section className="dr-modal-section">
                <h3 className="dr-eyebrow">What to bid</h3>
                <BidLadder
                  openingBid={Math.round(analytics.openingBid)}
                  targetBid={Math.round(analytics.targetBid)}
                  maxBid={Math.round(analytics.maxBid)}
                  walkAway={Math.round(analytics.walkAwayPoint)}
                  currentBid={currentBid}
                />
              </section>
            )}

            <section className="dr-modal-section">
              <h3 className="dr-eyebrow">How the price was reached</h3>
              <dl className="dr-facts">
                <div>
                  <dt>List value</dt>
                  <dd>${player.estimatedValue}</dd>
                </div>
                <div>
                  <dt>Value over replacement</dt>
                  <dd>{player.valueOverReplacement} pts</dd>
                </div>
                <div>
                  <dt>Market inflation</dt>
                  <dd>{analytics ? `${analytics.marketInflation}×` : '—'}</dd>
                </div>
                <div>
                  <dt>Position gone</dt>
                  <dd>{analytics ? `${Math.round(analytics.positionScarcity * 100)}%` : '—'}</dd>
                </div>
                <div>
                  <dt>Your need</dt>
                  <dd>{analytics ? `${analytics.needMultiplier}×` : '—'}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{analytics ? `${analytics.confidenceLevel}%` : '—'}</dd>
                </div>
                <div>
                  <dt>Adjusted value</dt>
                  <dd>{money(analytics?.adjustedValue)}</dd>
                </div>
                <div>
                  <dt>Tier</dt>
                  <dd>{player.tier}</dd>
                </div>
              </dl>
              <p className="dr-footnote">
                List value is value over replacement turned into a share of the league's budget.
                Inflation, scarcity and need move it as the draft runs — confidence is how much of
                this player we have actually seen play.
              </p>
            </section>
          </div>
        )}
      </article>
    </div>
  );
};
