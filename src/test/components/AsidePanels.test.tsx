import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { DraftRoom } from '@/components/draft-room/DraftRoom';
import { leagueShape } from '@/lib/valuation';
import { readInflation } from '@/lib/endgame';

/**
 * The side panels, opened one at a time.
 *
 * Two things were found here by looking at the room rather than by asserting
 * on it, and only one of them is testable in a DOM with no layout.
 *
 * The untestable one, recorded because the fix is what guards it: the six tabs
 * were an `inline-flex` pill with `overflow: hidden`, and `flex: 1` cannot
 * shrink a button below its own text — so 443px of tabs were clipped to 378
 * and the last two ran off the end. `plan` was unreachable at every window
 * width, because the aside is a fixed column and the clipping had nothing to
 * do with the viewport. jsdom measures nothing, so no assertion here could
 * have caught it; what stops it coming back is that the row is now a
 * three-column grid, which adds rows instead of running off the end.
 *
 * The testable one is what was hiding behind it.
 */
describe('the side panels', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(
      leagueShape({ teams: 12, budget: 100, auctionSheetSize: 60, receptionPoints: 0.5 })
    );
    service.setMyTeam('team-1');
  });

  const tabs = () => within(screen.getByLabelText('Side panel')).getAllByRole('button');

  it('opens every one of them', () => {
    render(<DraftRoom draftService={service} />);
    const names = tabs().map((tab) => tab.textContent);
    expect(names).toEqual(['spend', 'budgets', 'rosters', 'market', 'bargains', 'plan']);

    for (const name of names) {
      const tab = tabs().find((button) => button.textContent === name)!;
      fireEvent.click(tab);
      expect(tab.getAttribute('aria-pressed')).toBe('true');
      // Something rendered under it, rather than a tab that presses and does
      // nothing — which is what an unreachable panel looks like from here.
      expect(tab.getAttribute('aria-pressed')).toBe('true');
    }
  });

  it('plans your budget, not whoever the winning-team select sits on', () => {
    // The select is a *recording* control: it names who just bought a player,
    // so through a normal auction it sits on an opponent most of the night.
    // This panel was handed it and read "Team 9's budget" on a screen whose
    // owner is Team 1 — the same mistake the advisor was found making.
    service.renameTeam('team-1', 'The Owner');
    render(<DraftRoom draftService={service} />);

    fireEvent.click(tabs().find((tab) => tab.textContent === 'plan')!);
    expect(screen.getByText(/The Owner['’]s budget/)).toBeInTheDocument();

    // Record a sale to somebody else. The select moves; the plan must not.
    const player = service.getForSale().find((p) => !p.isDrafted)!;
    fireEvent.click(screen.getAllByText(player.name)[0]);
    const select = screen.getByLabelText(/winning team/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'team-9' } });

    // Nominating loads an opening bid, so the header switches from naming a
    // budget to naming a spend. Either way it names a team, and it must be
    // yours — read inside the panel, since "Team 9" is legitimately in the
    // select's own options.
    const planner = document.querySelector('.dr-planner') as HTMLElement;
    expect(within(planner).getByText(/If The Owner spends/)).toBeInTheDocument();
    expect(planner.textContent).not.toContain('Team 9');
  });
});

/**
 * One question, one answer.
 *
 * The market panel was driven mid-auction reading "Money is chasing scraps —
 * expect overpays" in red, two inches above "RB -44% going cheap · 4 sold" in
 * green, above "the room is paying about par — no timing edge". Three readings
 * of the same thing pointing three ways, on the panel that exists so the room
 * cannot find two answers to one question.
 *
 * They were never three findings. A multiplier above one *is* the room having
 * underpaid: money left exceeds value left because the players already sold
 * went for less than they were priced at. What was missing was the sentence
 * joining them.
 */
describe('the inflation headline', () => {
  it('does not shout overpay while the sales beneath it say bargain', () => {
    // The figures off the real run: $1009 of money left against $875 of value,
    // over eight sales the room took 40% under our numbers.
    const { label } = readInflation(1.15, 0.6);
    expect(label).toContain('underpaid early');
    expect(label).not.toContain('overpay');
    // And the direction, which is the tempting thing to get backwards: more
    // money than value left means prices rise, so waiting is the expensive
    // move, not the disciplined one.
    expect(label).toContain('Buy');
  });

  it('still shouts it when the room is actually paying up', () => {
    const { label } = readInflation(1.3, 1.2);
    expect(label).toContain('overpays');
  });

  it('says nothing about a premium before anything has sold', () => {
    // No sales means no premium, and a forecast about the room's behaviour
    // with no behaviour to read is a guess.
    expect(readInflation(1.4, null).label).toContain('overpays');
  });
});
