import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { DraftRoom } from '@/components/draft-room/DraftRoom';
import { leagueShape } from '@/lib/valuation';

/**
 * Front, back, and the back grown.
 *
 * The sequence is the design and it is the thing worth pinning: clicking a card
 * nominates, `↻` turns it over, and only the turned-over card offers to grow.
 * Expanding straight off the front was built first and is wrong — it is a
 * screen-filling panel on a single click, on the surface somebody scans while a
 * name is being called, and the click that does it sits a few pixels from the
 * click that puts a player on the block.
 *
 * jsdom has no layout, so what the flip *looks* like is not assertable here.
 * What is assertable is everything that decides whether the interaction is
 * correct: which faces exist, which one is reachable, what each control does,
 * and that nominating still happens on a plain click.
 */
describe('the card, turned over', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(
      leagueShape({ teams: 12, budget: 100, auctionSheetSize: 60, receptionPoints: 0.5 })
    );
    service.setMyTeam('team-1');
    service.confirmLeague();
  });

  const board = () => document.querySelector('.dr-grid') as HTMLElement;
  const firstCard = () => board().querySelector('.dr-flip') as HTMLElement;

  it('leaves the board alone until something is turned over', () => {
    render(<DraftRoom draftService={service} />);
    expect(board()).toBeTruthy();
    // No card is flipped, so no second page has been built at all — sixty of
    // them would be sixty career arcs and sixty schedule strips on a board
    // whose whole performance story is that it mounts sixty cards.
    expect(document.querySelectorAll('.dr-card-backface')).toHaveLength(0);
    expect(document.querySelector('.dr-lift')).toBeNull();
  });

  it('turns one card over, and only that one', () => {
    render(<DraftRoom draftService={service} />);
    const flip = within(firstCard()).getAllByRole('button', { name: /Turn .* over/ })[0];
    fireEvent.click(flip);

    expect(firstCard().getAttribute('data-flipped')).toBe('true');
    expect(document.querySelectorAll('.dr-card-backface')).toHaveLength(1);
    expect(document.querySelectorAll('.dr-flip[data-flipped="true"]')).toHaveLength(1);
  });

  it('does not nominate when the card is turned over', () => {
    render(<DraftRoom draftService={service} />);
    fireEvent.click(within(firstCard()).getAllByRole('button', { name: /Turn .* over/ })[0]);
    // The stage still has nobody on it: turning a card over is a study act and
    // must not put money on the table.
    expect(screen.getByText(/Pick a player from the board/)).toBeTruthy();
  });

  it('still nominates on a plain click, which is the primary act', () => {
    render(<DraftRoom draftService={service} />);
    const front = firstCard().querySelector('.dr-flip-front') as HTMLElement;
    fireEvent.click(front);
    expect(screen.queryByText(/Pick a player from the board/)).toBeNull();
  });

  /*
   * The load-bearing half of the whole redesign. The front carries nineteen
   * readings and is already at the limit of what can be scanned while a name is
   * being called; growing it to the full dossier is reachable only from the
   * back, where somebody has already decided to study rather than to bid.
   */
  it('offers to expand from the back and nowhere else', () => {
    render(<DraftRoom draftService={service} />);
    expect(screen.queryByRole('button', { name: /Expand .* to the full dossier/ })).toBeNull();

    fireEvent.click(within(firstCard()).getAllByRole('button', { name: /Turn .* over/ })[0]);
    expect(screen.getByRole('button', { name: /Expand .* to the full dossier/ })).toBeTruthy();
  });

  it('raises the card into its own layer, leaving the board where it was', () => {
    render(<DraftRoom draftService={service} />);
    const cardsBefore = board().querySelectorAll('.dr-flip').length;

    fireEvent.click(within(firstCard()).getAllByRole('button', { name: /Turn .* over/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Expand .* to the full dossier/ }));

    const lift = document.querySelector('.dr-lift');
    expect(lift).toBeTruthy();
    expect(lift?.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('.dr-card.is-expanded')).toBeTruthy();
    // Every card the board had, it still has. The raised copy lives outside the
    // grid precisely so that nothing in the grid has to move for it.
    expect(board().querySelectorAll('.dr-flip')).toHaveLength(cardsBefore);
    expect(board().className).toContain('is-receded');
  });

  it('carries the full dossier once it is raised', () => {
    render(<DraftRoom draftService={service} />);
    fireEvent.click(within(firstCard()).getAllByRole('button', { name: /Turn .* over/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Expand .* to the full dossier/ }));

    const raised = document.querySelector('.dr-card.is-expanded') as HTMLElement;
    // The second page down the left, every tab of the dossier to the right.
    expect(raised.querySelector('.dr-card-backface')).toBeTruthy();
    expect(within(raised).getByRole('button', { name: /Put him on the block/ })).toBeTruthy();
    expect(within(raised).getByText('Research')).toBeTruthy();
  });

  /* Each control undoes exactly the step that was taken, so escape lands on the
     back rather than on the board — which is where the expansion was opened
     from and what somebody expects to still be reading. */
  it('closes back onto the card it was raised from', () => {
    render(<DraftRoom draftService={service} />);
    fireEvent.click(within(firstCard()).getAllByRole('button', { name: /Turn .* over/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Expand .* to the full dossier/ }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.dr-lift')).toBeNull();
    expect(firstCard().getAttribute('data-flipped')).toBe('true');

    fireEvent.click(within(firstCard()).getAllByRole('button', { name: /Turn .* back over/ })[0]);
    expect(firstCard().getAttribute('data-flipped')).toBeNull();
  });
});
