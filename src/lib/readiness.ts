/**
 * Whether the board somebody is about to draft off is actually set up.
 *
 * Every catastrophic failure this app can have is silent. A league left at the
 * pool's own defaults prices 628 players under somebody else's rules; a sheet
 * that lost eight names to a spelling re-prices the room for an auction nobody
 * is holding; no team marked as yours turns the plan, the walk-away and four
 * panels inert. None of those announces itself — the board renders, the numbers
 * look authoritative, and the first evidence is a roster you cannot explain in
 * December.
 *
 * The individual warnings mostly exist already, scattered across the settings
 * panel, the import panel and the market panel, and each is only seen by
 * somebody who opens that panel. What did not exist is anywhere that answers
 * the one question worth asking on the night: *is this ready?*
 *
 * Three levels, and the distinction is what to do about it now:
 *
 *   `blocking` — a number on the board is wrong, not merely unknown. Fix before
 *   bidding.
 *
 *   `warn` — the board is right but a reading is missing or coarse. It costs
 *   precision, not correctness.
 *
 *   `ready` — nothing to do, and it is listed anyway, because a checklist that
 *   only shows problems cannot be used to confirm there are none.
 *
 * A fact module: it states what is true of the setup and never what to bid.
 */

export type ReadinessLevel = 'blocking' | 'warn' | 'ready';

export interface ReadinessCheck {
  /** Stable, and names its subject, so React can key on it. */
  id: string;
  /** What was checked, in three or four words. */
  label: string;
  level: ReadinessLevel;
  /** What is true, and where to fix it when it is not. */
  detail: string;
}

export interface ReadinessSubject {
  /** Has anybody confirmed the league, as opposed to accepting the defaults? */
  leagueConfirmed: boolean;
  /** Whether the shape in force is still the one the pool was priced at. */
  leagueIsPoolDefault: boolean;
  /** Names of the positions the pool is too thin at for this league. */
  poolShortfall: string[];
  /** How many players the commissioner's sheet resolved to, or null for none. */
  sheetSize: number | null;
  /** Rows the paste lost, as a share of the rows it was given. */
  sheetLoss: number;
  /** Whether a size is set without a list behind it. */
  sheetIsGuess: boolean;
  myTeam: string | null;
  /** Teams still carrying the names the app made up. */
  unnamedTeams: number;
  totalTeams: number;
  snakeOrderDrawn: boolean;
  /** Days since the last real draft the market snapshot sampled. */
  marketDays: number | null;
  /** Days since the research file was written. */
  researchDays: number | null;
  /** Picks already made, so a warning can say whether it is too late to fix. */
  drafted: number;
}

/** Past a week the market has moved; pre-season ADP moves fastest at the end. */
const MARKET_STALE_DAYS = 7;
/** Research is dated per finding, but a whole file this old has stopped being news. */
const RESEARCH_STALE_DAYS = 14;
/** One row in eight, the band the sheet import already refuses to be quiet about. */
const SHEET_LOSS_LOUD = 0.125;

export const readiness = (subject: ReadinessSubject): ReadinessCheck[] => {
  const checks: ReadinessCheck[] = [];
  const started = subject.drafted > 0;

  checks.push(
    !subject.leagueConfirmed
      ? {
          id: 'league',
          label: 'League confirmed',
          level: 'blocking',
          detail:
            'Nobody has confirmed the scoring and roster, so the board is priced at the pool’s own ' +
            'defaults — full PPR, no flex. Every dollar on every card comes from those numbers.',
        }
      : subject.leagueIsPoolDefault
        ? {
            id: 'league',
            label: 'League confirmed',
            level: 'warn',
            detail:
              'Confirmed, but the shape in force is the one the pool was built at. That is a valid ' +
              'league and almost certainly not the one being played — check the scoring and the flex.',
          }
        : {
            id: 'league',
            label: 'League confirmed',
            level: 'ready',
            detail: 'Scoring, roster and budget have been set deliberately.',
          }
  );

  if (subject.poolShortfall.length) {
    checks.push({
      id: 'pool',
      label: 'Pool deep enough',
      level: 'blocking',
      detail:
        `The pool is shorter than this league rosters at ${subject.poolShortfall.join(', ')}, so ` +
        'replacement level there falls back to the worst player it holds and understates the whole ' +
        'position. Rebuild with npm run build:pool.',
    });
  }

  checks.push(
    subject.sheetSize == null
      ? {
          id: 'sheet',
          label: 'Commissioner’s sheet',
          level: subject.sheetIsGuess ? 'blocking' : 'warn',
          detail: subject.sheetIsGuess
            ? 'A sheet *size* is set with no list behind it, so which players are being auctioned is ' +
              'the model’s guess. It will price players the commissioner never listed and floor ones ' +
              'he did. Paste the real list.'
            : 'No sheet, so the whole board is being auctioned. Right for some leagues and wrong for ' +
              'a hybrid — if the commissioner circulates sixty names, paste them.',
        }
      : subject.sheetLoss >= SHEET_LOSS_LOUD
        ? {
            id: 'sheet',
            label: 'Commissioner’s sheet',
            level: 'blocking',
            detail:
              `${subject.sheetSize} names resolved, but about one row in ` +
              `${Math.round(1 / Math.max(subject.sheetLoss, 0.001))} was lost. A paste that loses a ` +
              'chunk out of the middle re-prices the whole board for an auction nobody is holding — ' +
              'the import panel lists every lost row to be fixed.',
          }
        : {
            id: 'sheet',
            label: 'Commissioner’s sheet',
            level: 'ready',
            detail: `${subject.sheetSize} names in force, and the paste lost nothing worth reporting.`,
          }
  );

  checks.push(
    subject.myTeam
      ? {
          id: 'mine',
          label: 'Your team marked',
          level: 'ready',
          detail: `The plan, the walk-away and the budget panels are computed for ${subject.myTeam}.`,
        }
      : {
          id: 'mine',
          label: 'Your team marked',
          level: 'blocking',
          detail:
            'No team is marked as yours, so there is no roster to plan against: the plan, every ' +
            'walk-away and four panels are inert. Mark one in league settings.',
        }
  );

  checks.push(
    subject.unnamedTeams === 0
      ? {
          id: 'names',
          label: 'Teams named',
          level: 'ready',
          detail: 'Every seat carries the name of whoever is sitting in it.',
        }
      : {
          id: 'names',
          label: 'Teams named',
          level: 'warn',
          detail:
            `${subject.unnamedTeams} of ${subject.totalTeams} are still called “Team N”. Nothing is ` +
            'wrong with the numbers, but recording a sale sixty times means finding the right seat ' +
            'sixty times, and a number is a thing to hold in your head at the moment there is no room.',
        }
  );

  checks.push(
    subject.snakeOrderDrawn
      ? {
          id: 'order',
          label: 'Snake order',
          level: 'ready',
          detail: 'Drawn, so every free man is the one that actually survives to your seat.',
        }
      : {
          id: 'order',
          label: 'Snake order',
          level: 'warn',
          detail:
            'Not drawn, so the plan averages the free men across all twelve draws. That is a real ' +
            'answer and not a guess — but the moment the commissioner draws it, entering it sharpens ' +
            'every gain and every walk-away on the board.',
        }
  );

  if (subject.marketDays != null) {
    checks.push(
      subject.marketDays > MARKET_STALE_DAYS
        ? {
            id: 'market',
            label: 'Draft market',
            level: started ? 'warn' : 'blocking',
            detail:
              `The newest real draft in the snapshot is ${subject.marketDays} days old, and the ` +
              'market is what orders this whole board. Pre-season ADP moves fastest in the fortnight ' +
              'before week one. npm run fetch:adp takes seconds.',
          }
        : {
            id: 'market',
            label: 'Draft market',
            level: 'ready',
            detail: `Real drafts from ${subject.marketDays} day${subject.marketDays === 1 ? '' : 's'} ago are driving the order.`,
          }
    );
  }

  if (subject.researchDays != null && subject.researchDays > RESEARCH_STALE_DAYS) {
    checks.push({
      id: 'research',
      label: 'Research',
      level: 'warn',
      detail:
        `Last written ${subject.researchDays} days ago. Findings carry their own dates so nothing ` +
        'here is pretending to be news, but a fortnight of camp is a fortnight of injuries.',
    });
  }

  return checks;
};

/** The worst level present, which is what a badge should show. */
export const worstOf = (checks: readonly ReadinessCheck[]): ReadinessLevel =>
  checks.some((check) => check.level === 'blocking')
    ? 'blocking'
    : checks.some((check) => check.level === 'warn')
      ? 'warn'
      : 'ready';
