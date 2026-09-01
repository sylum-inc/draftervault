/**
 * Team colours, made usable as accents.
 *
 * A club's colour is chosen to look good on a helmet, not to be legible as a
 * three-pixel mark on a near-black interface — and the range is enormous. The
 * Raiders are black, the Ravens are a purple two shades off the ground, the
 * Dolphins are an aqua that glows. Used raw as an accent, half the league
 * disappears into the background and the other half shouts over the numbers,
 * and neither failure is about the player.
 *
 * So the raw colour is kept for anything with its own contrast handling — a
 * position badge sets ink against it deliberately — and everything drawn *on*
 * the dark ground uses a lifted version instead: the same hue, moved into a
 * luminance band that reads. That is what makes it possible to use team colour
 * as identity at all rather than as decoration that works for eighteen clubs.
 */

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const parse = (hex: string): [number, number, number] | null => {
  const value = hex.replace('#', '');
  if (value.length !== 6) return null;
  const parts = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  return parts.some((part) => Number.isNaN(part)) ? null : [parts[0], parts[1], parts[2]];
};

const toHex = ([r, g, b]: [number, number, number]): string =>
  `#${[r, g, b]
    .map((part) =>
      Math.round(clamp01(part / 255) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;

/** Perceived brightness, 0 to 1. The usual coefficients. */
const luminance = ([r, g, b]: [number, number, number]): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Readable ink for a colour used as a background.
 *
 * Was written out twice — once on the card and once on the nomination stage —
 * which is two answers to one question and the sort of thing that only ever
 * gets noticed when a light jersey turns a label white on white.
 */
export const inkFor = (hex: string): string => {
  const rgb = parse(hex);
  if (!rgb) return '#ffffff';
  return luminance(rgb) > 0.6 ? '#0b0f17' : '#ffffff';
};

/**
 * The same colour, moved into a band that reads on the dark ground.
 *
 * Dark clubs are blended toward white until they are visible; very bright ones
 * are pulled back a little so they stop competing with the price, which is the
 * one thing on a card that is allowed to shout. A colour already in the band is
 * returned untouched, so most of the league is unaffected and the ones that
 * needed help stop being invisible.
 */
export const accentFor = (hex: string, floor = 0.34, ceiling = 0.78): string => {
  const rgb = parse(hex);
  if (!rgb) return hex;
  const level = luminance(rgb);

  if (level < floor) {
    // Toward white by however much is missing. Solving it exactly would need a
    // per-channel walk; one blend gets within a few per cent and keeps the hue.
    const mix = clamp01((floor - level) / Math.max(1 - level, 0.001));
    return toHex(rgb.map((part) => part + (255 - part) * mix) as [number, number, number]);
  }
  if (level > ceiling) {
    const mix = clamp01((level - ceiling) / level) * 0.6;
    return toHex(rgb.map((part) => part * (1 - mix)) as [number, number, number]);
  }
  return hex;
};
