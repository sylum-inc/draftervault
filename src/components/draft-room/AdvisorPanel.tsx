import { groupRoomRead } from '@/services/draftAdvisor';
import type { Advice, Alert, NominationPlan, RoomRead } from '@/services/draftAdvisor';

interface AdvisorPanelProps {
  advice: Advice | null;
  alerts: Alert[];
  /** What to nominate, what to sit on. Null in the snake, where nobody nominates. */
  plan: NominationPlan | null;
  /**
   * What the room would plausibly pay, opponent by opponent.
   *
   * The estimate half of the who-can-outbid-you question. The legal ceilings it
   * sits beside are on the nomination stage, in the measurement register, and
   * the two are deliberately not interleaved — a rule and a guess printed in
   * one column is how somebody comes to bid against a number nobody would say.
   */
  room: RoomRead | null;
  /**
   * Whose side the advice is on.
   *
   * Everything in this panel is written for one roster's holes and one budget,
   * and until a team is marked as the owner's there is no roster to write for.
   * Naming it is not decoration: advice for Team 4 read as advice for you is
   * worse than no advice, because it is confidently wrong about the only thing
   * that matters.
   */
  speakingFor: string | null;
  onDismiss: () => void;
}

const VERDICT_COLOR: Record<Advice['verdict'], string> = {
  BID: 'var(--dr-value)',
  VALUE: 'var(--dr-value)',
  TAKE: 'var(--dr-value)',
  HOLD: 'var(--dr-caution)',
  PASS: 'var(--dr-danger)',
};

const VERDICT_WORD: Record<Advice['verdict'], string> = {
  BID: 'Bid',
  VALUE: 'Good value',
  // The snake half, where the only question is whether to spend the slot.
  TAKE: 'Take him',
  HOLD: 'Hold',
  PASS: 'Walk away',
};

/** What a nomination is for, in one word each. */
const KIND_WORD: Record<NominationPlan['calls'][number]['kind'], string> = {
  drain: 'Drain',
  stopper: 'Buy him now',
  scarcity: 'Scarcity',
  value: 'Best left',
};

/**
 * The advisor, kept in its own box on purpose.
 *
 * Everything else on screen is a measurement; this is an opinion, and it is
 * dressed differently so the difference is never in doubt — its own border, its
 * own label, and every call shown with the reasoning that produced it rather
 * than as a verdict from nowhere. It is off until someone turns it on.
 */
export const AdvisorPanel = ({
  advice,
  alerts,
  plan,
  room,
  speakingFor,
  onDismiss,
}: AdvisorPanelProps) => (
  <section className="dr-advisor" aria-label="Advisor — opinions, not measurements">
    <header className="dr-advisor-head">
      <span className="dr-advisor-badge">Advisor</span>
      <span className="dr-advisor-caveat">
        {speakingFor ? `opinion, for ${speakingFor}` : 'opinion, not data'}
      </span>
      <button className="dr-linkish" onClick={onDismiss}>
        turn off
      </button>
    </header>

    {/* Advice is written for one roster. Without a team marked as the owner's
        there is none, and the honest thing is to say so rather than to quietly
        advise on behalf of whichever team happens to be selected in the
        winning-team box — which is a recording control, not a statement about
        whose side anybody is on. */}
    {!speakingFor && (
      <p className="dr-advisor-idle">
        No team is marked as yours, so there is no roster to advise for. Open league settings and
        say which one you are.
      </p>
    )}

    {advice ? (
      <div className="dr-advice">
        <div className="dr-advice-verdict" style={{ color: VERDICT_COLOR[advice.verdict] }}>
          <strong>{VERDICT_WORD[advice.verdict]}</strong>
          {/* A snake pick has no stop price. "$0" beside a free player reads as
              advice to spend nothing on him, which is a different claim. */}
          {advice.stopAt != null && <span className="dr-num">up to ${advice.stopAt}</span>}
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
      speakingFor && (
        <p className="dr-advisor-idle">
          Put a player on the block and pick a team to get a read on the pick.
        </p>
      )
    )}

    {/*
      What the room would plausibly pay.

      Every number in this block is an estimate and it says so twice: in the
      heading, and by sitting inside the dashed box rather than beside the bid
      controls. The legal ceiling is printed alongside precisely because the two
      diverge — a team allowed $180 who would sensibly stop at $22 is the case
      the whole feature exists for, and hiding either number loses it.
    */}
    {/* Rendered whenever there is anything to say, which includes the case
        where there is nobody left. Gating on rivals alone hid the section at
        exactly the bid where it was most useful: once the bid clears every
        rival's plausible number the list empties, so the panel went blank while
        the legal-ceiling list beside it still showed eleven teams at $200. The
        viewer was left looking at eleven apparent threats with the one fact
        that answers them computed and then thrown away. */}
    {room && (room.rivals.length > 0 || room.quiet > 0) && (
      <div className="dr-advice-room">
        <span className="dr-eyebrow">Where the bidding should end</span>
        <p className="dr-advice-headline">
          {room.rivals.length === 0 ? (
            <>Nobody left has a reason to go higher.</>
          ) : (
            <>
              Expect it to reach about <strong className="dr-num">${room.topPlausible}</strong>
            </>
          )}
          {room.myCeiling != null && <> — you are allowed ${room.myCeiling}.</>}
        </p>
        <ul className="dr-advice-rivals">
          {groupRoomRead(room).map((group) => (
            <li key={`${group.plausible}|${group.why}`}>
              <span className="dr-advice-rival-team">{group.names}</span>
              <span className="dr-num dr-advice-rival-plausible">${group.plausible}</span>
              <span className="dr-advice-rival-legal">
                of ${group.legal} allowed{group.count > 1 ? ' each' : ''}
              </span>
              <span className="dr-advice-rival-why">{group.why}</span>
            </li>
          ))}
        </ul>
        {room.quiet > 0 && (
          <p className="dr-footnote">
            {room.quiet} other{room.quiet === 1 ? '' : 's'} could legally beat it but have no reason
            to.
          </p>
        )}
      </div>
    )}

    {plan && (
      <div className="dr-advice-nomination">
        <span className="dr-eyebrow">Your nomination</span>
        <p className="dr-advice-headline">{plan.headline}</p>
        <ul className="dr-advice-calls">
          {plan.calls.map((call) => (
            <li key={call.player.id}>
              <span className="dr-advice-kind" data-kind={call.kind}>
                {KIND_WORD[call.kind]}
              </span>
              <strong>{call.player.name}</strong>
              <p>{call.reason}</p>
            </li>
          ))}
        </ul>
        {plan.protect.length > 0 && (
          <>
            <span className="dr-eyebrow">Do not put these up yet</span>
            <ul className="dr-advice-calls">
              {plan.protect.map((held) => (
                <li key={held.player.id}>
                  <strong>{held.player.name}</strong>
                  <p>{held.reason}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    )}

    {alerts.length > 0 && (
      <ul className="dr-advisor-alerts">
        {alerts.map((alert) => (
          /* Keyed on the id rather than the message: two alerts that read alike
             — a run and a tier break at one position — collided on the text and
             React dropped one of them without saying so. */
          <li key={alert.id} className={alert.severity === 'warning' ? 'is-warning' : undefined}>
            {alert.message}
          </li>
        ))}
      </ul>
    )}
  </section>
);
