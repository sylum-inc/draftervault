import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { DraftRoom } from '@/components/draft-room/DraftRoom';
import { leagueShape } from '@/lib/valuation';

/**
 * Solo mode, driven rather than reasoned about.
 *
 * The rule the whole backend is built under is that the app keeps working
 * exactly as it did with no server, no account and no network — and that this
 * is the ordinary state, not a degraded one. The unit tests assert that the
 * client makes no request; this asserts what somebody actually sees. The room
 * opens, the server button is there, the panel behind it says there is no
 * server in words rather than showing a broken connection, and nothing has been
 * fetched or logged by the time any of that happened.
 */
describe('the room with no server, which is how it ships', () => {
  let service: AuctionDraftService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let noise: Array<unknown[]>;
  let restore: () => void;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    noise = [];
    const error = console.error;
    const warn = console.warn;
    console.error = (...args: unknown[]) => noise.push(args);
    console.warn = (...args: unknown[]) => noise.push(args);
    restore = () => {
      console.error = error;
      console.warn = warn;
    };
  });

  afterEach(() => {
    restore();
    vi.unstubAllGlobals();
  });

  /**
   * What was asked for that could only be a server of ours.
   *
   * Not "nothing was fetched": the room already freshens injury status from
   * ESPN on mount, which has been true since long before any of this and falls
   * back to the bundled snapshot on failure. What must be zero is calls to a
   * Draft Vault API, because with no address configured there is nothing to
   * call and a speculative attempt is what puts a red line in the console.
   */
  const serverCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/'));

  it('opens the server panel and says there is none, quietly', () => {
    render(<DraftRoom draftService={service} />);

    // The label carries no state when there is nothing to be in a state about.
    // The server lives behind the setup menu now, with the other things that
    // are set up once a night.
    fireEvent.click(screen.getByRole('button', { name: /^Setup/ }));
    const button = screen.getByRole('menuitem', { name: 'Server' });
    fireEvent.click(button);

    expect(screen.getByRole('dialog', { name: 'Server' })).toBeInTheDocument();
    expect(
      screen.getByText(/No server configured, which is the ordinary state/)
    ).toBeInTheDocument();

    // Not one request to a server, and not one word to the console.
    expect(serverCalls()).toEqual([]);
    expect(noise).toEqual([]);
  });

  /**
   * The board is what the night runs on, so it has to be exactly what it was.
   * Nominating and buying a player with no server is the whole app, and nothing
   * added here may sit between a click and a pick.
   */
  it('drafts a player with nothing listening anywhere', () => {
    render(<DraftRoom draftService={service} />);
    const player = service.getAvailablePlayers()[0];
    fireEvent.click(screen.getAllByText(player.name)[0]);

    expect(screen.getByLabelText(`Nomination: ${player.name}`)).toBeInTheDocument();
    expect(service.draftPlayer(player.id, service.getTeams()[0].id, 5)).toBe(true);
    expect(service.getHistory()).toHaveLength(1);
    expect(serverCalls()).toEqual([]);
  });
});
