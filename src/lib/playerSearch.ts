/**
 * Finding a player by typing part of their name, fast.
 *
 * The board's search was a plain substring match on the printed name, which
 * meant the punctuation had to be typed exactly. Nobody reaches for the
 * apostrophe in Ja'Marr, the hyphen in Amon-Ra or the full stop in St. Brown
 * while an auction is running, so the board came back empty for a top-five
 * player at the worst possible moment.
 *
 * This is deliberately not the same as the importer's `normaliseName`: that one
 * also strips generational suffixes, because two sources spell "Kenneth Walker
 * III" differently. Here somebody typing "walker iii" should still find him, so
 * only punctuation goes.
 */

/** Lowercase, and drop anything that is not a letter, digit or space. */
export const searchable = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9 ]+/g, '');

/**
 * Whether a player's searchable text matches what has been typed so far.
 *
 * Empty input matches everything, so the board shows the full list rather than
 * nothing before anyone types.
 */
export const matchesSearch = (key: string, needle: string): boolean =>
  needle === '' || key.includes(needle);
