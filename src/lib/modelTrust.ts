/**
 * Where this board is measurably worse than the room, and where it is not.
 *
 * `npm run backtest` holds out 2023, 2024 and 2025 one at a time and scores the
 * projection model against real half-PPR draft-market ADP. The finding is in
 * CLAUDE.md in full; the part a drafter has to act on is that **on surplus over
 * replacement — what a bid actually buys — the market's board beat ours in all
 * three seasons and in 11 of the 12 position-seasons**, and that where the two
 * boards disagreed most sharply the market finished nearer the truth every
 * year, on players worth roughly twice as much in hindsight.
 *
 * That reverses the reading the bargain board invites. A wide gap between our
 * rank and consensus looks like a bargain and is more often this board being
 * wrong. It is still worth showing — a player the room is cold on is genuinely
 * cheaper to buy, which is the only thing that makes anyone cheap — but the gap
 * is evidence about the bidding, not about the player.
 *
 * This module is the one place that knowledge lives, for the same reason
 * `valuation.ts` holds the league and `researchContract.ts` holds the citation
 * rule: a caveat rendered in two panels from two copies of the thresholds is
 * two claims that can drift apart, and the one that has not been updated is the
 * one somebody reads at the moment a name is called.
 *
 * Every threshold here is a bucket the backtest actually printed. Nothing is
 * invented to look thorough — a caveat nobody measured would be indistinguish-
 * able on screen from the three that were, and would spend their credibility.
 */

export interface TrustCaveat {
  /** Stable, and names its subject, so React can key on it. */
  id: string;
  /** Four or five words, for a chip beside a name. */
  label: string;
  /** What was measured, with the numbers. */
  detail: string;
}

/** The three seasons every figure in this file was measured over. */
export const BACKTEST_SEASONS = '2023-25';

/**
 * The single line the bargain board leads with.
 *
 * Stated as a measurement rather than as advice, because it is one, and because
 * the advisor is a separate module by design and this is not it.
 */
export const CONSENSUS_VERDICT =
  `Measured over ${BACKTEST_SEASONS}, the room's board sorted these players better than ours ` +
  'in 11 of 12 position-seasons, and on the widest disagreements the room was nearer the ' +
  'truth in all three years. A large gap is a reason to check our number, not a bargain.';

/** What `modelCaveats` needs. A subset of `Player`, so anything can be scored. */
export interface TrustSubject {
  position: string;
  age?: number | null;
  /** Games of tape the projection was built from. Absent on an older pool. */
  gamesObserved?: number | null;
}

/**
 * A partial season of tape is the worst input this model takes, by a distance.
 *
 * Six games at a high rate shrink to a respectable rate against an eight-game
 * prior and are then multiplied by seventeen games nobody has a reason to
 * expect. It is also exactly the shape of a sleeper, which is why it is worth
 * saying out loud rather than leaving in a document.
 */
const PARTIAL_TAPE_MAX = 16;
/** Ageing is discounted by the model, and the backtest says not nearly enough. */
const OLD_AGE = 30;

export const modelCaveats = (player: TrustSubject): TrustCaveat[] => {
  const caveats: TrustCaveat[] = [];

  const tape = player.gamesObserved;
  if (tape != null && tape > 0 && tape <= PARTIAL_TAPE_MAX) {
    caveats.push({
      id: `tape:${player.position}`,
      label: `${tape} games of tape`,
      detail:
        `On players with 1-16 games behind them the model scored rho 0.21, 0.13 and 0.04 ` +
        `across ${BACKTEST_SEASONS} — no ranking signal at all — while last season's raw points ` +
        'scored 0.52 to 0.58 on the same players. It over-projected them by 58 to 72 points.',
    });
  }

  if (player.age != null && player.age >= OLD_AGE) {
    caveats.push({
      id: 'age:30',
      label: `age ${player.age}`,
      detail:
        `Thirty-and-over is the model's worst age group every season (rho 0.475, 0.512, 0.414 ` +
        "against last season's points at 0.696, 0.675, 0.753). The age curve discounts, but not " +
        'enough and not early enough, and it over-projects this group by 52 to 66 points.',
    });
  }

  if (player.position === 'TE') {
    caveats.push({
      id: 'position:TE',
      label: 'tight end',
      detail:
        'Tight end is where the board should be trusted least against the room: rho 0.110, 0.133 ' +
        "and -0.114 against the market's 0.375, 0.478 and -0.046 on the players being drafted.",
    });
  }

  return caveats;
};
