import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { AuctionDraftService } from '@/services/auctionDraftService';
import { DraftRoom } from '@/components/draft-room/DraftRoom';
import { leagueShape } from '@/lib/valuation';
import { copyTextToClipboard, saveTextFile } from '@/lib/saveFile';

/**
 * The room, driven for the two things that are not about bidding: whether a
 * pick recorded wrongly can be put right, and whether the owner can see how
 * much of the night he would lose with the tab.
 *
 * Both were found by driving a whole draft rather than by reasoning about one.
 * The engine tests prove the log ends up right; this proves somebody sitting at
 * the table can get it there.
 */
vi.mock('@/lib/saveFile', () => ({
  saveTextFile: vi.fn(async (filename: string) => ({ status: 'saved', filename })),
  copyTextToClipboard: vi.fn(async () => true),
}));

const savedFile = vi.mocked(saveTextFile);
const copied = vi.mocked(copyTextToClipboard);

describe('the record, corrected and kept, from the room', () => {
  let service: AuctionDraftService;
  let ids: string[];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    savedFile.mockImplementation(async (filename: string) => ({ status: 'saved', filename }));
    copied.mockImplementation(async () => true);
    service = new AuctionDraftService(leagueShape({ auctionSheetSize: 60 }));
    ids = [...service.getPlayers()]
      .filter((player) => player.valueOverReplacement > 0)
      .sort((a, b) => b.modelValue - a.modelValue)
      .slice(0, 40)
      .map((player) => player.id);
    service.setAuctionSheet(ids);
  });

  const openBoard = () => {
    fireEvent.click(screen.getByRole('button', { name: 'The room' }));
    return screen.getByLabelText('League draft board');
  };

  it('corrects a misheard price from the cell that shows it', async () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 25);
    render(<DraftRoom draftService={service} />);

    const board = openBoard();
    const cell = within(board).getByTitle(/^#1 .* — \$40\. Click to correct it\.$/);
    fireEvent.click(cell);

    const editor = screen.getByLabelText('Correct a pick');
    expect(within(editor).getByText('Pick #1')).toBeInTheDocument();
    fireEvent.change(within(editor).getByLabelText('Price'), { target: { value: '18' } });
    // What it costs is on screen before the button is pressed.
    expect(within(editor).getByText(/Nothing else changes/)).toBeInTheDocument();
    fireEvent.click(within(editor).getByRole('button', { name: 'Apply the correction' }));

    await waitFor(() => expect(service.getHistory()[0].cost).toBe(18));
    expect(service.getTeams().find((team) => team.id === 'team-1')!.spent).toBe(18);
    expect(screen.getByText(/Corrected — all 2 picks still replay/)).toBeInTheDocument();
  });

  it('names the later picks a correction would cost, before it is applied', () => {
    service.draftPlayer(ids[0], 'team-1', 10);
    service.draftPlayer(ids[1], 'team-1', 20);
    render(<DraftRoom draftService={service} />);

    const board = openBoard();
    fireEvent.click(within(board).getByTitle(/^#1 .* — \$10\./));
    const editor = screen.getByLabelText('Correct a pick');
    fireEvent.change(within(editor).getByLabelText('Price'), { target: { value: '195' } });

    expect(
      within(editor).getByText(/1 later pick could no longer have happened/)
    ).toBeInTheDocument();
    expect(within(editor).getByText(/#2 .* only has \$5 left/)).toBeInTheDocument();
    // The button says what pressing it costs rather than hiding it in a toast
    // that arrives after the picks are gone.
    expect(within(editor).getByRole('button', { name: 'Apply, losing 1' })).toBeInTheDocument();
    expect(service.getHistory()).toHaveLength(2);
  });

  it('corrects the wrong one of two similar names', async () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    render(<DraftRoom draftService={service} />);

    const board = openBoard();
    fireEvent.click(within(board).getByTitle(/^#1 /));
    const editor = screen.getByLabelText('Correct a pick');

    const right = service.getPlayers().find((player) => player.id === ids[7])!;
    fireEvent.change(within(editor).getByLabelText('Search for the right player'), {
      target: { value: right.name },
    });
    const match = within(editor)
      .getAllByRole('button', { pressed: false })
      .find((button) => button.textContent?.includes(right.name));
    fireEvent.click(match!);
    fireEvent.click(within(editor).getByRole('button', { name: 'Apply the correction' }));

    await waitFor(() => expect(service.getHistory()[0].playerId).toBe(right.id));
    expect(service.getPlayers().find((p) => p.id === ids[0])!.isDrafted).toBe(false);
  });

  it('puts back a pick undone by an accidental keystroke', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    render(<DraftRoom draftService={service} />);

    fireEvent.keyDown(document, { key: 'u' });
    expect(service.getHistory()).toHaveLength(0);
    // The offer appears only once there is something to put back.
    expect(screen.getByRole('button', { name: 'Redo (1)' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'r' });
    expect(service.getHistory()).toHaveLength(1);
    expect(service.getPlayers().find((p) => p.id === ids[0])!.draftCost).toBe(40);
    expect(screen.queryByRole('button', { name: /Redo/ })).not.toBeInTheDocument();
  });

  it('counts the picks since the draft last left this browser, and stops on a save', async () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 25);
    render(<DraftRoom draftService={service} />);

    expect(screen.getByRole('button', { name: '2 unsaved' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 's' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy kept' })).toBeTruthy());
    expect(savedFile).toHaveBeenCalledTimes(1);
    // What went out is the file's own payload, so what comes back through the
    // file panel is the same draft.
    expect(savedFile.mock.calls[0][1]).toContain('draft-vault-draft');
    expect(service.picksSinceExport()).toBe(0);
  });

  it('starts counting again the moment the record moves', async () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    service.draftPlayer(ids[1], 'team-2', 25);
    render(<DraftRoom draftService={service} />);
    fireEvent.keyDown(document, { key: 's' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy kept' })).toBeTruthy());

    fireEvent.keyDown(document, { key: 'u' });

    // An undo moves the record away from the file just as a pick does.
    await waitFor(() => expect(screen.getByRole('button', { name: '1 unsaved' })).toBeTruthy());
  });

  it('copies the whole draft, and falls back to a file when the clipboard refuses', async () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    render(<DraftRoom draftService={service} />);

    fireEvent.keyDown(document, { key: 'c' });
    await waitFor(() => expect(copied).toHaveBeenCalledTimes(1));
    // The same payload a file carries, so what is pasted loads straight back in.
    const pasted = JSON.parse(copied.mock.calls[0][0]);
    expect(pasted.kind).toBe('draft-vault-draft');
    expect(pasted.picks).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy kept' })).toBeTruthy());

    // A sandbox that withholds the clipboard is not a failure to report: it is
    // the other door.
    copied.mockImplementation(async () => false);
    service.draftPlayer(ids[1], 'team-2', 20);
    fireEvent.keyDown(document, { key: 'c' });

    await waitFor(() => expect(savedFile).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/clipboard is not available here/)).toBeInTheDocument();
  });

  it('never fires a shortcut inside the search box', () => {
    service.draftPlayer(ids[0], 'team-1', 40);
    render(<DraftRoom draftService={service} />);

    const search = screen.getByLabelText('Search players');
    fireEvent.keyDown(search, { key: 's' });
    fireEvent.keyDown(search, { key: 'c' });
    fireEvent.keyDown(search, { key: 'u' });

    expect(savedFile).not.toHaveBeenCalled();
    expect(copied).not.toHaveBeenCalled();
    expect(service.getHistory()).toHaveLength(1);
  });
});
