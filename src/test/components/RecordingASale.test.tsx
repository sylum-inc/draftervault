import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { DraftRoom } from '@/components/draft-room/DraftRoom';
import { leagueShape } from '@/lib/valuation';

/**
 * The act that happens sixty times.
 *
 * Everything else in this app is read once or twice a night. Recording a sale —
 * who won, for how much — happens for every player on the commissioner's sheet,
 * while somebody shouts a number across a room, and it is the only place where
 * the interface being slow costs the draft rather than the patience.
 *
 * It was a `<select>` of twelve options all beginning with the word "Team", so
 * typeahead matched every one of them and reaching team nine was nine arrow
 * presses or a mouse trip into a dropdown that covers the board. Measured in a
 * browser: nine.
 */
describe('recording a sale', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(
      leagueShape({ teams: 12, budget: 100, auctionSheetSize: 60, receptionPoints: 0.5 })
    );
    service.setMyTeam('team-1');
    service.confirmLeague();
  });

  const nominate = () => {
    const player = service.getForSale().find((entry) => !entry.isDrafted)!;
    fireEvent.click(screen.getAllByText(player.name)[0]);
    return player;
  };
  const row = () => screen.getByRole('group', { name: /winning team/i });

  it('offers every team as one press, with the money on the button', () => {
    render(<DraftRoom draftService={service} />);
    nominate();

    const chips = within(row()).getAllByRole('button');
    expect(chips).toHaveLength(12);
    // The budget is on the control, so "can they even afford him" is answered
    // without opening anything — it was previously a sentence underneath.
    expect(within(row()).getByRole('button', { name: /Team 9/ }).textContent).toContain('$100');
  });

  it('records the winner in one press and sells at the bid', () => {
    render(<DraftRoom draftService={service} />);
    const player = nominate();

    fireEvent.click(within(row()).getByRole('button', { name: /Team 9/ }));
    fireEvent.change(document.getElementById('dr-bid')!, { target: { value: '37' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sold/ }));

    const sold = service.getPlayers().find((entry) => entry.id === player.id)!;
    expect(sold.isDrafted).toBe(true);
    expect(sold.draftCost).toBe(37);
    expect(sold.draftedBy).toBe('team-9');
  });

  /* Pressing the same team again clears it, because the alternative is that a
     mis-click can only be corrected by finding the right team — and on this
     control the mis-click and the correction are the same gesture. */
  it('lets a mis-pressed team be taken back', () => {
    render(<DraftRoom draftService={service} />);
    nominate();
    const nine = within(row()).getByRole('button', { name: /Team 9/ });

    fireEvent.click(nine);
    expect(nine.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(nine);
    expect(nine.getAttribute('aria-pressed')).toBe('false');
    // With nobody named there is nothing to record, and the engine is never
    // asked to reject it.
    expect((screen.getByRole('button', { name: /^Sold/ }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  /*
   * The price arrives before the winner does — it is shouted while the bidding
   * runs, and who won is only known when it stops. Focus used to land on the
   * team control, which is the opposite order to the one the information
   * arrives in.
   */
  it('puts the cursor in the bid box, which is what is known first', () => {
    render(<DraftRoom draftService={service} />);
    nominate();
    // The room defers the focus by a tick so the stage has rendered.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(document.activeElement?.id).toBe('dr-bid');
        resolve();
      }, 0);
    });
  });

  it('marks your own team without confusing it with who just bought somebody', () => {
    render(<DraftRoom draftService={service} />);
    nominate();

    const mine = within(row()).getByRole('button', { name: /Team 1\b/ });
    const other = within(row()).getByRole('button', { name: /Team 9/ });
    expect(mine.hasAttribute('data-mine')).toBe(true);
    expect(other.hasAttribute('data-mine')).toBe(false);

    // Recording a sale to somebody else moves the pressed state and leaves the
    // ownership mark exactly where it was. Four panels have been caught reading
    // one of these as the other.
    fireEvent.click(other);
    expect(other.getAttribute('aria-pressed')).toBe('true');
    expect(mine.hasAttribute('data-mine')).toBe(true);
    expect(mine.getAttribute('aria-pressed')).toBe('false');
  });

  it('refuses a team that cannot carry him rather than accepting and rejecting', () => {
    // Fill team 3's roster to its limit at the position on the block.
    const player = service.getForSale().find((entry) => !entry.isDrafted)!;
    const limit = service.getLeagueShape().positionLimits[player.position] ?? 0;
    for (const other of service
      .getPlayers()
      .filter((entry) => entry.position === player.position && entry.id !== player.id)
      .slice(0, limit)) {
      service.draftPlayer(other.id, 'team-3', 1);
    }
    render(<DraftRoom draftService={service} />);
    fireEvent.click(screen.getAllByText(player.name)[0]);

    const three = within(row()).getByRole('button', { name: /Team 3/ }) as HTMLButtonElement;
    expect(three.disabled).toBe(true);
    // And it stays in place while disabled: a row that reorders under the
    // cursor mid-auction is worse than a button that says why it cannot be used.
    expect(within(row()).getAllByRole('button')[2]).toBe(three);
  });
});
