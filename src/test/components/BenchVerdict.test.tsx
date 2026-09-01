import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AuctionDraftService, type Player, type SnakeGain } from '@/services/auctionDraftService';
import { NominationStage } from '@/components/draft-room/NominationStage';
import { leagueShape } from '@/lib/valuation';

/**
 * Two claims on one screen may not point opposite ways.
 *
 * Found by looking rather than by asserting. The stage said "Bench only — he
 * is a bench player and adds nothing to the lineup that scores", and four
 * inches lower, an inch above the sold button, "Below value" in green. Both
 * sentences are true: the price comparison is against the *league's* bar, and
 * a bench body really can be under it. But green next to a bid box is an
 * argument to buy, and in this format there is none — the snake hands you
 * eleven bench bodies for nothing.
 *
 * So the words stay and the encouragement goes. What is pinned here is the
 * relationship, not the wording: whenever the stage calls a player bench-only,
 * the verdict beside the bid box is not in the colour that means buy.
 */
describe('the value verdict, against a roster that is full', () => {
  let service: AuctionDraftService;
  let player: Player;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ teams: 12, budget: 100 }));
    player = service.getAvailablePlayers()[0];
  });

  const stage = (snakeGain: SnakeGain | null) => {
    render(
      <NominationStage
        mode="auction"
        player={player}
        teams={service.getTeams()}
        teamId="team-1"
        // Deliberately a dollar: as far below the model's number as a bid gets,
        // so the unqualified verdict is at its most encouraging.
        bid="1"
        analytics={service.getPlayerAnalytics(player.id, 'team-1')}
        check={null}
        onTeamChange={() => {}}
        onBidChange={() => {}}
        onConfirm={() => {}}
        canDraft={() => true}
        sheetRemaining={null}
        onUnsold={() => {}}
        onReturnToSheet={() => {}}
        passedOver={false}
        adjusted={null}
        inflation={1}
        competition={null}
        snakeGain={snakeGain}
      />
    );
    const box = screen.getByLabelText(`Nomination: ${player.name}`);
    const line = within(box).getByText('Against our number').parentElement!;
    return { box, line, verdict: line.querySelector('strong')! };
  };

  const gain = (slot: SnakeGain['slot'], points = 40): SnakeGain =>
    slot === 'bench'
      ? { gain: 0, free: null, freeId: null, freePoints: null, slot, note: 'Your slots are full.' }
      : {
          gain: points,
          free: 'Somebody',
          freeId: 'free-1',
          freePoints: 100,
          slot,
          note: 'Fills a slot.',
        };

  it('says buy when the slot is open', () => {
    const { verdict } = stage(gain('starter'));
    expect(verdict.textContent).toContain('Below value');
    expect(verdict.getAttribute('style')).toContain('--dr-value');
  });

  it('withholds the colour, and says which lineup, when he is bench only', () => {
    const { box, line, verdict } = stage(gain('bench'));
    expect(within(box).getByText('Bench only.')).toBeInTheDocument();
    // The comparison is unchanged — it is still true of the league's bar.
    expect(verdict.textContent).toContain('Below value');
    // What it no longer does is read as a reason to bid.
    expect(verdict.getAttribute('style')).not.toContain('--dr-value');
    expect(line.textContent).toContain('not to your lineup');
  });

  it('withholds it too when the snake hands you somebody better, free', () => {
    // The sharper of the two cases and the one that found this: the stage read
    // "Buying him gains -35 pts over Jonathan Taylor, free in the snake" with a
    // green "Below value" an inch under it. A seat can be open and still not
    // worth paying for.
    const { line, verdict } = stage(gain('flex', -35));
    expect(verdict.textContent).toContain('Below value');
    expect(verdict.getAttribute('style')).not.toContain('--dr-value');
    expect(line.textContent).toContain('hands you better, free');
  });

  it('leaves an overpay alone, because it is already saying do not', () => {
    render(<></>);
    const analytics = service.getPlayerAnalytics(player.id, 'team-1');
    render(
      <NominationStage
        mode="auction"
        player={player}
        teams={service.getTeams()}
        teamId="team-1"
        bid={String(analytics.maxBid + 50)}
        analytics={analytics}
        check={null}
        onTeamChange={() => {}}
        onBidChange={() => {}}
        onConfirm={() => {}}
        canDraft={() => true}
        sheetRemaining={null}
        onUnsold={() => {}}
        onReturnToSheet={() => {}}
        passedOver={false}
        adjusted={null}
        inflation={1}
        competition={null}
        snakeGain={gain('bench')}
      />
    );
    const box = screen.getAllByLabelText(`Nomination: ${player.name}`).at(-1)!;
    const line = within(box).getByText('Against our number').parentElement!;
    const verdict = line.querySelector('strong')!;
    expect(verdict.textContent).toContain('Overpay');
    expect(verdict.getAttribute('style')).toContain('--dr-danger');
    expect(line.textContent).not.toContain('not to your lineup');
  });
});

/**
 * The man you are measured against, and what the web said about him.
 *
 * The gain on the stage is a *difference* against one named player, and the
 * projection knows only what he has done. On the shipped research file the free
 * back is under an NFL review that could suspend him and the free tight end
 * tore an Achilles in January — both sourced, both dated, and neither reached
 * the one number they move, because nothing joined the two registers at the
 * point a bid is decided.
 *
 * It carries no figure, exactly as the research contract has no price field. It
 * says which way the difference is soft.
 */
describe('the free man in the snake, and what was found about him', () => {
  let service: AuctionDraftService;
  let player: Player;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService(leagueShape({ teams: 12, budget: 100 }));
    player = service.getAvailablePlayers()[0];
  });

  const stage = (
    slot: SnakeGain['slot'],
    research: { direction: 'PAY_UP' | 'FADE' | 'NEUTRAL'; headline: string } | null
  ) => {
    render(
      <NominationStage
        mode="auction"
        player={player}
        teams={service.getTeams()}
        teamId="team-1"
        bid="10"
        analytics={service.getPlayerAnalytics(player.id, 'team-1')}
        check={null}
        onTeamChange={() => {}}
        onBidChange={() => {}}
        onConfirm={() => {}}
        canDraft={() => true}
        sheetRemaining={null}
        onUnsold={() => {}}
        onReturnToSheet={() => {}}
        passedOver={false}
        adjusted={null}
        inflation={1}
        competition={null}
        snakeGain={
          // Bench returns no free man at all from the engine: the snake hands
          // you any of eleven bodies, so there is no one player the difference
          // is against. The fixture matches that rather than inventing one.
          slot === 'bench'
            ? { gain: 0, free: null, freeId: null, freePoints: null, slot, note: 'Slots full.' }
            : {
                gain: 55,
                free: 'George Kittle',
                freeId: 'free-kittle',
                freePoints: 137,
                slot,
                note: 'Fills your TE1.',
              }
        }
        freeManResearch={research}
      />
    );
    return screen.getByLabelText(`Nomination: ${player.name}`);
  };

  it('says the gain is understated when the free man is fading', () => {
    const box = stage('starter', {
      direction: 'FADE',
      headline: 'Torn Achilles in January; still individual drills only',
    });
    expect(within(box).getByText(/George Kittle is flagged/)).toBeInTheDocument();
    expect(within(box).getByText(/understate this bid/)).toBeInTheDocument();
  });

  it('says the other thing when the free man is the one being paid up for', () => {
    const box = stage('starter', { direction: 'PAY_UP', headline: 'Handed the job outright' });
    expect(within(box).getByText(/overstate it/)).toBeInTheDocument();
  });

  it('stays quiet when nothing was found', () => {
    expect(within(stage('starter', null)).queryByText(/is flagged/)).not.toBeInTheDocument();
  });

  it('stays quiet when what was found was not material', () => {
    // NEUTRAL is "we looked and there is nothing to say", which is not the same
    // as a finding — putting it on the stage would be noise wearing a source.
    const box = stage('starter', { direction: 'NEUTRAL', headline: 'nothing much' });
    expect(within(box).queryByText(/is flagged/)).not.toBeInTheDocument();
  });

  it('names nobody when there is no free man to name', () => {
    // Bench only: the snake hands you any of eleven bodies, so there is no one
    // player the difference is against.
    const box = stage('bench', { direction: 'FADE', headline: 'Torn Achilles' });
    expect(within(box).queryByText(/is flagged/)).not.toBeInTheDocument();
  });
});
