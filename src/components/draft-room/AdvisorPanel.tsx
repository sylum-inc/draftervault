import type { Advice, Alert } from '@/services/draftAdvisor';

interface AdvisorPanelProps {
  advice: Advice | null;
  alerts: Alert[];
  nomination: { name: string; reason: string } | null;
  onDismiss: () => void;
}

const VERDICT_COLOR: Record<Advice['verdict'], string> = {
  BID: 'var(--dr-value)',
  VALUE: 'var(--dr-value)',
  HOLD: 'var(--dr-caution)',
  PASS: 'var(--dr-danger)',
};

const VERDICT_WORD: Record<Advice['verdict'], string> = {
  BID: 'Bid',
  VALUE: 'Good value',
  HOLD: 'Hold',
  PASS: 'Walk away',
};

/**
 * The advisor, kept in its own box on purpose.
 *
 * Everything else on screen is a measurement; this is an opinion, and it is
 * dressed differently so the difference is never in doubt — its own border, its
 * own label, and every call shown with the reasoning that produced it rather
 * than as a verdict from nowhere. It is off until someone turns it on.
 */
export const AdvisorPanel = ({ advice, alerts, nomination, onDismiss }: AdvisorPanelProps) => (
  <section className="dr-advisor" aria-label="Advisor — opinions, not measurements">
    <header className="dr-advisor-head">
      <span className="dr-advisor-badge">Advisor</span>
      <span className="dr-advisor-caveat">opinion, not data</span>
      <button className="dr-linkish" onClick={onDismiss}>
        turn off
      </button>
    </header>

    {advice ? (
      <div className="dr-advice">
        <div className="dr-advice-verdict" style={{ color: VERDICT_COLOR[advice.verdict] }}>
          <strong>{VERDICT_WORD[advice.verdict]}</strong>
          <span className="dr-num">up to ${advice.stopAt}</span>
        </div>
        <p className="dr-advice-headline">{advice.headline}</p>
        <ul className="dr-advice-reasons">
          {advice.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="dr-footnote">
          Confidence {advice.confidence.toLowerCase()} — based on how much recent tape the
          projection has behind it.
        </p>
      </div>
    ) : (
      <p className="dr-advisor-idle">
        Put a player on the block and pick a team to get a read on the bid.
      </p>
    )}

    {nomination && (
      <div className="dr-advice-nomination">
        <span className="dr-eyebrow">Your nomination</span>
        <strong>{nomination.name}</strong>
        <p>{nomination.reason}</p>
      </div>
    )}

    {alerts.length > 0 && (
      <ul className="dr-advisor-alerts">
        {alerts.map((alert) => (
          <li
            key={alert.message}
            className={alert.severity === 'warning' ? 'is-warning' : undefined}
          >
            {alert.message}
          </li>
        ))}
      </ul>
    )}
  </section>
);
