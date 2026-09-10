import { useEffect, useState } from 'react';
import {
  freshnessDays,
  loadPlayerResearch,
  loadResearch,
  type Direction,
  type PlayerResearch,
} from '@/services/playerResearch';

interface ResearchPanelProps {
  playerId: string;
  playerName: string;
}

/**
 * What was found on the web about one player, and what it argues.
 *
 * This is a third kind of thing, and it is drawn like one. A card's numbers are
 * measurements; the advisor's calls are opinions in a dashed box; these are
 * claims somebody else published, which we have checked the provenance of but
 * not the truth of. So every line carries the site that said it and the day it
 * was said, and the link is always there to be followed — the panel is asking
 * to be argued with, not believed.
 *
 * There is deliberately no dollar figure anywhere in here. The direction says
 * which way the evidence pushes against our own number; the number itself is
 * computed a few tabs over from three seasons of play-by-play, and mixing the
 * two would make the researched one look as though it had been measured.
 */

const DIRECTION_LABEL: Record<Direction, string> = {
  PAY_UP: 'Pay up',
  FADE: 'Fade',
  NEUTRAL: 'Nothing material',
};

const DIRECTION_COLOR: Record<Direction, string> = {
  PAY_UP: 'var(--dr-value)',
  FADE: 'var(--dr-danger)',
  NEUTRAL: 'var(--dr-ink-muted)',
};

const IMPACT_MARK: Record<string, string> = {
  POSITIVE: '↑',
  NEGATIVE: '↓',
  CONTEXT: '·',
};

/** "3 days ago", because "2026-08-26" makes the reader do the arithmetic. */
const ago = (days: number): string =>
  days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;

export const ResearchPanel = ({ playerId, playerName }: ResearchPanelProps) => {
  const [research, setResearch] = useState<PlayerResearch | null>(null);
  const [stamp, setStamp] = useState<{ generatedAt: string | null; model: string | null } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void Promise.all([loadPlayerResearch(playerId), loadResearch()]).then(([record, file]) => {
      if (!live) return;
      setResearch(record);
      setStamp({ generatedAt: file.generatedAt, model: file.model });
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [playerId]);

  if (loading) {
    return (
      <div className="dr-tabpanel" role="tabpanel">
        <p className="dr-meter-note">Loading research…</p>
      </div>
    );
  }

  // Nobody has ever run the batch. Say what would make this tab work rather
  // than showing an empty box that looks like a finding of "nothing".
  if (!stamp?.generatedAt) {
    return (
      <div className="dr-tabpanel" role="tabpanel">
        <section className="dr-research dr-research-idle">
          <header className="dr-research-head">
            <span className="dr-research-badge">Research</span>
            <span className="dr-advisor-caveat">reported elsewhere, not measured here</span>
          </header>
          <p className="dr-meter-note">
            No research has been run. <code>npm run research:players</code> asks a web-searching
            model about every player in the pool and keeps only the claims it can point at a source
            and a date for. It needs an <code>OPENROUTER_API_KEY</code> in the shell; nothing is
            fetched from the browser, so the room still works without it.
          </p>
        </section>
      </div>
    );
  }

  const stale = research ? freshnessDays(research) : null;
  const dropped = research
    ? research.dropped.unsourced + research.dropped.undated + research.dropped.malformed
    : 0;

  return (
    <div className="dr-tabpanel" role="tabpanel">
      <section className="dr-research" aria-label={`Research on ${playerName}`}>
        <header className="dr-research-head">
          <span className="dr-research-badge">Research</span>
          <span className="dr-advisor-caveat">reported elsewhere, not measured here</span>
        </header>

        {!research || research.findings.length === 0 ? (
          <p className="dr-meter-note">
            {research
              ? 'Searched, and nothing turned up that the projection does not already know. That is a result, not a gap — most players do not have news.'
              : 'This player was not in the last research run.'}
          </p>
        ) : (
          <>
            <div className="dr-research-verdict">
              <span style={{ color: DIRECTION_COLOR[research.direction] }}>
                {DIRECTION_LABEL[research.direction]}
              </span>
              <span className="dr-research-confidence">{research.confidence}</span>
              {stale !== null && stale > 21 && (
                <span
                  className="dr-research-stale"
                  title="The newest source here is over three weeks old"
                >
                  stale
                </span>
              )}
            </div>
            {research.headline && <p className="dr-advice-headline">{research.headline}</p>}
            <p className="dr-footnote">
              Which way the evidence pushes against our projection — not a price. The price is on
              the Value tab and is computed from production.
            </p>

            <ul className="dr-research-findings">
              {research.findings.map((finding) => (
                <li key={finding.url + finding.claim}>
                  <span className="dr-research-impact" aria-hidden="true">
                    {IMPACT_MARK[finding.impact] ?? '·'}
                  </span>
                  <div>
                    <p className="dr-research-claim">{finding.claim}</p>
                    <p className="dr-research-source">
                      <a href={finding.url} target="_blank" rel="noreferrer noopener">
                        {finding.source}
                      </a>
                      <span> · {finding.published}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="dr-footnote">
          {stale !== null && `Newest source ${ago(stale)}. `}
          Looked up {new Date(research?.researchedAt ?? stamp.generatedAt).toLocaleDateString()}
          {stamp.model ? ` with ${stamp.model}` : ''}.
          {dropped > 0 &&
            ` ${dropped} claim${dropped === 1 ? '' : 's'} discarded for citing nothing the search
             returned, or carrying no date.`}
        </p>
      </section>
    </div>
  );
};
