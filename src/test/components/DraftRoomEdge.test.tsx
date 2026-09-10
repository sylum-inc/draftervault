import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { DraftRoom } from '@/components/draft-room/DraftRoom';
import { leagueShape } from '@/lib/valuation';

/**
 * The room itself, driven rather than reasoned about.
 *
 * Everything under test here was found by clicking rather than by unit tests:
 * that the ceilings appear beside the bid box at all, that the advisor names
 * whose side it is on, and that the two registers stay in their own panels.
 * The engine tests prove the numbers; this proves somebody can see them.
 */
describe('the room, driven', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
  });

  const nominate = () => {
    const player = service.getAvailablePlayers()[0];
    fireEvent.click(screen.getAllByText(player.name)[0]);
    return player;
  };

  it('shows who can beat the bid, in dollars the engine would accept', () => {
    render(<DraftRoom draftService={service} />);
    const player = nominate();

    const stage = screen.getByLabelText(`Nomination: ${player.name}`);
    // Nominating loads an opening bid, so the heading is already about beating
    // a number rather than about bidding at all.
    expect(within(stage).getByText(/^Can beat \$\d+$/)).toBeInTheDocument();
    expect(within(stage).getByText('what the rules allow')).toBeInTheDocument();

    // The figure printed against the first opponent is the one validateBid
    // takes. Reading it off the screen rather than off the engine is the point:
    // this is the number somebody bids against.
    const rival = service.getBidCompetition(player.id, 0)!.rivals[0];
    expect(within(stage).getAllByText(`$${rival.ceiling}`).length).toBeGreaterThan(0);
    expect(service.validateBid(player.id, rival.team.id, rival.ceiling).ok).toBe(true);
  });

  it('says plainly that no team has been marked as yours', () => {
    // A fresh browser now marks one — four panels were inert without it, one of
    // them the snake gain this whole format turns on. The refusal still has to
    // work, because unmarking is a thing somebody can do and advising for a
    // team nobody chose is the bug this message exists to prevent.
    service.seedHomeDefaults();
    service.setMyTeam(null);
    render(<DraftRoom draftService={service} />);
    // The advisor is on by default now — the panel that answers "what do I do
    // now" was behind a button nobody had pressed. What keeps it an opinion is
    // the box, the badge and the caveat, not the default.
    expect(screen.getByRole('button', { name: /Advisor on/ })).toBeInTheDocument();

    expect(screen.getByText(/No team is marked as yours/)).toBeInTheDocument();
  });

  it('speaks for the owner’s team rather than whoever won the last bid', () => {
    service.setMyTeam('team-1');
    service.renameTeam('team-1', 'The Owner');
    service.renameTeam('team-5', 'Somebody Else');
    render(<DraftRoom draftService={service} />);
    nominate();

    // Naming the winning team is a recording control: it records who bought a
    // player, and through a normal auction it sits on an opponent most of the
    // time. Advice computed against it was advice about their roster.
    fireEvent.click(
      within(screen.getByRole('group', { name: /winning team/i })).getByRole('button', {
        name: /Somebody Else/,
      })
    );

    const advisor = screen.getByLabelText('Advisor — opinions, not measurements');
    expect(within(advisor).getByText('opinion, for The Owner')).toBeInTheDocument();
    expect(within(advisor).queryByText(/for Somebody Else/)).not.toBeInTheDocument();
  });

  it('keeps the estimate out of the measurement panel and the rule out of the advice', () => {
    service.setMyTeam('team-1');
    render(<DraftRoom draftService={service} />);
    const player = nominate();

    const stage = screen.getByLabelText(`Nomination: ${player.name}`);
    const advisor = screen.getByLabelText('Advisor — opinions, not measurements');

    // The stage carries the rules and says so; the estimate of where the
    // bidding ends is in the dashed box, and neither borrows the other's words.
    expect(within(stage).queryByText(/Where the bidding should end/)).not.toBeInTheDocument();
    expect(within(advisor).queryByText('what the rules allow')).not.toBeInTheDocument();
    expect(within(advisor).getByText(/Where the bidding should end/)).toBeInTheDocument();
  });

  it('prints tonight’s price beside the list price, with the multiplier that made it', () => {
    // A pick well over list moves the room; before one, the two numbers agree
    // and the second line is not worth the space.
    const players = service.getAvailablePlayers();
    service.draftPlayer(players[0].id, 'team-2', players[0].estimatedValue * 2);
    render(<DraftRoom draftService={service} />);
    const player = nominate();

    const stage = screen.getByLabelText(`Nomination: ${player.name}`);
    const adjust = service.getPriceAdjuster();
    // One tile, two figures: the restated price and the multiplier that made
    // it. Read off the tile itself, because the same dollar figure can appear
    // again further down the block in the plan.
    const tile = within(stage).getByTitle("List price restated at the room's inflation");
    expect(tile).toHaveTextContent(`$${adjust.price(player)}`);
    expect(tile).toHaveTextContent(`${adjust.inflation.toFixed(2)}×`);
  });

  it('shows the adjusted price as its own column on the table board', () => {
    const players = service.getAvailablePlayers();
    service.draftPlayer(players[0].id, 'team-2', players[0].estimatedValue * 2);
    render(<DraftRoom draftService={service} />);

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(
      screen.getByTitle("What he costs at the room's current inflation, not the list price")
    ).toBeInTheDocument();
  });

  it('explains the inflation number in the market panel', () => {
    service.draftPlayer(service.getAvailablePlayers()[0].id, 'team-2', 120);
    render(<DraftRoom draftService={service} />);
    fireEvent.click(screen.getByRole('button', { name: 'Market' }));

    const basis = service.getInflationBasis();
    const market = screen.getByLabelText('Market');
    expect(within(market).getByText('Money left')).toBeInTheDocument();
    expect(within(market).getByText(`$${basis.moneyLeft}`)).toBeInTheDocument();
    expect(within(market).getByText('Next tier break')).toBeInTheDocument();
  });
});
