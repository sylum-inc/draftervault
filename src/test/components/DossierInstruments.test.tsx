import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricStrip, ScoringMix, Threshold } from '@/components/draft-room/charts/profile';
import { leagueShape, pointsFor } from '@/lib/valuation';

/**
 * The dossier's instruments, and the arithmetic under them.
 *
 * jsdom has no layout, so nothing here asserts what a strip looks like. What it
 * does assert is every number an instrument prints — which is where the two
 * defects actually were: a normal tail written the wrong way round, and a
 * percentile that has to flip for a metric where a smaller number is a better
 * one.
 */
describe('the threshold on a projection', () => {
  const gibbs = { projection: 278, floor: 253, ceiling: 361 };

  it('is nearly certain to clear a bar far below the floor', () => {
    // This shipped as 0%. `tailAbove` is Q(z) — the chance of exceeding a
    // *standardised threshold* — and it was being handed the distance back to
    // the mean instead, which inverts the answer for every reading.
    render(<Threshold {...gibbs} replacement={72} />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('reads the tail correctly a standard deviation up', () => {
    render(<Threshold {...gibbs} replacement={72} />);
    // Floor and ceiling are one deviation either side, so sd is 54. Asking for
    // 332 is +1 sd, which is the 16% tail.
    fireEvent.change(screen.getByLabelText('Points threshold'), { target: { value: '332' } });
    expect(screen.getByText(/1[4-8]%/)).toBeTruthy();
  });

  /* Replacement level sits well below a good player's floor, and the slider
     opens on it — so a range of floor-to-ceiling clamped the handle to its left
     end while the label read the true number. A control saying one thing and
     showing another is worse than no control. */
  it('keeps its opening threshold inside its own range', () => {
    render(<Threshold {...gibbs} replacement={72} />);
    const slider = screen.getByLabelText('Points threshold') as HTMLInputElement;
    expect(Number(slider.min)).toBeLessThanOrEqual(72);
    expect(Number(slider.value)).toBe(72);
  });
});

describe('a metric against its cohort', () => {
  const field = Array.from({ length: 20 }, (_, index) => ({
    id: `p${index}`,
    name: `Player ${index}`,
    value: index,
  }));

  it('prints the percentile of the man it is drawn for', () => {
    render(<MetricStrip label="Points" points={field} mineId="p18" format={(v) => `${v}`} />);
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText(/9[0-9]th/)).toBeTruthy();
  });

  /* Age, games missed, sack rate allowed, points allowed, seconds per play:
     five readings on this screen where the smaller number is the better one. A
     percentile that does not flip reports the best defence in the league as the
     worst. */
  it('flips the percentile where a smaller number is a better one', () => {
    const { rerender } = render(
      <MetricStrip label="Age" points={field} mineId="p2" format={(v) => `${v}`} />
    );
    // Two of twenty below him plus half his own tie: 13th, and 87th read the
    // other way round. The midpoint keeps two identical players from coming out
    // a rank apart because of the order they happened to be listed in.
    expect(screen.getByText('13th')).toBeTruthy();
    rerender(<MetricStrip label="Age" points={field} mineId="p2" format={(v) => `${v}`} invert />);
    expect(screen.getByText('87th')).toBeTruthy();
  });

  it('draws nothing rather than a scale from too few readings', () => {
    const { container } = render(
      <MetricStrip label="Points" points={field.slice(0, 3)} mineId="p1" format={(v) => `${v}`} />
    );
    expect(container.querySelector('.dr-strip')).toBeNull();
  });
});

describe('where a season’s points came from', () => {
  /*
   * The guard that matters is the units.
   *
   * `player-history.json` stores nflverse's full-PPR total and this league pays
   * half, so a mix built straight off the file would print a season a fifth too
   * large directly beneath a projection that is not — the quiet drift
   * `valuation.ts` exists to prevent, one register out. The decomposition goes
   * through the same `pointsFor` the pool builder and the board come through.
   */
  it('states a season at the league being played, not at the source file’s', () => {
    const half = leagueShape({ teams: 12, budget: 100, receptionPoints: 0.5 });
    const season = { position: 'WR', points: 300, receptions: 100 };
    expect(pointsFor(season, half)).toBe(250);

    const total = pointsFor(season, half);
    const parts = [
      { key: 'td', label: 'touchdowns', points: 8 * 6 },
      { key: 'rec', label: 'receiving', points: 1200 / 10 + 100 * half.receptionPoints },
    ];
    render(
      <ScoringMix seasons={[{ season: 2025, total, parts, tdShare: 48 / total }]} tdNorm={0.27} />
    );
    expect(screen.getByText(/19%/)).toBeTruthy();
    expect(screen.getByText(/a typical starter 27%/)).toBeTruthy();
  });

  it('names the segment under the cursor', () => {
    render(
      <ScoringMix
        seasons={[
          {
            season: 2025,
            total: 200,
            parts: [
              { key: 'td', label: 'touchdowns', points: 60 },
              { key: 'rush', label: 'rushing', points: 140 },
            ],
            tdShare: 0.3,
          },
        ]}
      />
    );
    const bands = document.querySelectorAll('.dr-mix rect');
    fireEvent.mouseEnter(bands[1]);
    expect(screen.getByText(/pts from rushing in/)).toBeTruthy();
  });
});
