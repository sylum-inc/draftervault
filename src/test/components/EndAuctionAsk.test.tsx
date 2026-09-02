import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuctionDraftService, type Player } from '@/services/auctionDraftService';
import { NominationStage } from '@/components/draft-room/NominationStage';
import { BidConsequence } from '@/components/draft-room/BidConsequence';
import { leagueShape } from '@/lib/valuation';

/**
 * The two things the block asks and answers in its own type rather than the
 * browser's. Ending the auction was the last `window.confirm` in the room, and
 * what a bid leaves you was two sections of the Tonight tab that belong beside
 * the box the bid is typed in.
 */
describe('the block asks and answers in its own type', () => {
  let service: AuctionDraftService;
  let player: Player;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ teams: 12, budget: 100 }));
    player = service.getAvailablePlayers()[0];
  });

  const stage = (sheetRemaining: number, onUnsold: () => void) =>
    render(
      <NominationStage
        mode="auction"
        player={{ ...player, onSheet: true }}
        teams={service.getTeams()}
        teamId=""
        bid="1"
        analytics={service.getPlayerAnalytics(player.id, 'team-1')}
        check={null}
        onTeamChange={() => {}}
        onBidChange={() => {}}
        onConfirm={() => {}}
        canDraft={() => true}
        sheetRemaining={sheetRemaining}
        onUnsold={onUnsold}
        onReturnToSheet={() => {}}
        passedOver={false}
        adjusted={null}
        inflation={1}
        competition={null}
        consequence={<p data-testid="consequence">what the bid does</p>}
      />
    );

  it('passes a player over at once while others remain on the sheet', () => {
    const onUnsold = vi.fn();
    stage(12, onUnsold);
    fireEvent.click(screen.getByRole('button', { name: 'Nobody bid' }));
    expect(onUnsold).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('asks before the last name ends the auction, and not through a browser dialog', () => {
    const onUnsold = vi.fn();
    const confirm = vi.spyOn(window, 'confirm');
    stage(1, onUnsold);
    fireEvent.click(screen.getByRole('button', { name: 'Nobody bid' }));
    expect(onUnsold).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    const ask = screen.getByRole('alertdialog', { name: 'End the auction?' });
    expect(ask.textContent).toMatch(/last name on the sheet/);
    fireEvent.click(screen.getByRole('button', { name: 'Keep him up' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onUnsold).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Nobody bid' }));
    fireEvent.click(screen.getByRole('button', { name: 'End the auction' }));
    expect(onUnsold).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('renders what the bid does beside the controls', () => {
    stage(12, () => {});
    expect(screen.getByTestId('consequence')).toBeTruthy();
  });
});

describe('what a bid leaves you', () => {
  const spend = { remaining: 72, slotsLeft: 15, minimumHold: 0, affordable: null, legal: true };
  const value = { gain: 124, worth: 47, seat: 'starter' } as never;
  const plan = { perDollar: 2.71 } as never;

  it('says nothing until a number is typed', () => {
    const { container } = render(
      <BidConsequence bid={Number.NaN} walkAway={47} value={value} plan={plan} spend={spend} />
    );
    expect(container.textContent).toBe('');
  });

  it('prices the bid against the plan and says what is left', () => {
    render(<BidConsequence bid={28} walkAway={47} value={value} plan={plan} spend={spend} />);
    const line = screen.getByText(/he buys/).closest('p')!;
    expect(line.textContent).toMatch(/\$28.*4\.43.*2\.71.*better than the money/);
    expect(line.getAttribute('data-tone')).toBe('good');
    expect(screen.getByText('Left after').nextElementSibling?.textContent).toBe('$72');
    expect(screen.getByText('Seats to buy').nextElementSibling?.textContent).toBe('15');
  });

  it('turns bad past the walk-away', () => {
    render(
      <BidConsequence
        bid={50}
        walkAway={47}
        value={value}
        plan={plan}
        spend={{ ...spend, remaining: 50 }}
      />
    );
    const line = screen.getByText(/he buys/).closest('p')!;
    expect(line.getAttribute('data-tone')).toBe('bad');
    expect(line.textContent).toMatch(/past your walk-away of \$47/);
  });
});
