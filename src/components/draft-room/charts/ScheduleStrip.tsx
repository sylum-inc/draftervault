export interface ScheduleGame {
  week: number;
  opponent: string;
  home: boolean;
  /** 0 = the stingiest defense in the league, 1 = the most generous. */
  difficulty: number | null;
}

interface ScheduleStripProps {
  games: ScheduleGame[];
  byeWeek: number | null;
  /** Weeks a fantasy season is usually decided in. */
  playoffWeeks?: number[];
}

const LAST_WEEK = 18;

/**
 * The season, week by week.
 *
 * One cell per week, shaded by how much the opponent's defense gave up last
 * season — a single hue, light for a hard matchup and saturated for a soft one,
 * because this is magnitude and not category. The bye is a gap rather than a
 * color, and the fantasy playoff weeks are bracketed, since that is the stretch
 * a drafted player is actually being bought for.
 */
export const ScheduleStrip = ({
  games,
  byeWeek,
  playoffWeeks = [15, 16, 17],
}: ScheduleStripProps) => {
  const byWeek = new Map(games.map((game) => [game.week, game]));

  return (
    <div className="dr-schedule">
      <div className="dr-schedule-strip">
        {Array.from({ length: LAST_WEEK }, (_, index) => index + 1).map((week) => {
          const game = byWeek.get(week);
          const playoff = playoffWeeks.includes(week);

          if (!game) {
            return (
              <div className="dr-week is-bye" key={week} title={`Week ${week}: bye`}>
                <span className="dr-week-number dr-num">{week}</span>
                <span className="dr-week-opponent">BYE</span>
              </div>
            );
          }

          const difficulty = game.difficulty;
          const tone =
            difficulty == null
              ? 0.18
              : // Soft defenses read strongest; tough ones nearly disappear.
                0.12 + difficulty * 0.62;

          return (
            <div
              className={`dr-week${playoff ? ' is-playoff' : ''}`}
              key={week}
              style={{
                background: `color-mix(in srgb, var(--dr-value) ${Math.round(tone * 100)}%, transparent)`,
              }}
              title={
                difficulty == null
                  ? `Week ${week}: ${game.home ? 'vs' : 'at'} ${game.opponent}`
                  : `Week ${week}: ${game.home ? 'vs' : 'at'} ${game.opponent} — opponent allowed ${
                      difficulty > 0.66
                        ? 'a lot'
                        : difficulty > 0.33
                          ? 'about average'
                          : 'very little'
                    } last season`
              }
            >
              <span className="dr-week-number dr-num">{week}</span>
              <span className="dr-week-opponent">
                {game.home ? '' : '@'}
                {game.opponent}
              </span>
            </div>
          );
        })}
      </div>

      <div className="dr-schedule-key">
        <span>Tougher defense</span>
        <span className="dr-schedule-ramp" aria-hidden="true" />
        <span>Softer</span>
        {byeWeek && <span className="dr-schedule-bye">Bye week {byeWeek}</span>}
      </div>
      <p className="dr-footnote">
        Shading is the opponent's points allowed per game last season — the only forward-looking
        read available before a snap of the new one. Bracketed weeks are the fantasy playoffs.
      </p>
    </div>
  );
};
