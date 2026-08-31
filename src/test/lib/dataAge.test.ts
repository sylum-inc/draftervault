import { describe, expect, it } from 'vitest';
import { dataAges, stalest, type DataStamps } from '@/lib/dataAge';

const NOW = Date.parse('2026-09-02T00:00:00Z');
const stamps = (over: Partial<DataStamps> = {}): DataStamps => ({
  market: { to: '2026-08-30' },
  research: '2026-08-30T03:39:33.148Z',
  pool: '2026-08-30T14:49:42.571Z',
  identity: '2026-08-25T05:39:18.361Z',
  ...over,
});

/**
 * The board fetches nothing on the night — that is what makes it work in the
 * published artifact and in a basement with no wifi. The cost is knowledge that
 * stopped at a moment nobody was shown, and the honest mitigation is to say
 * when rather than to imply it has not stopped.
 */
describe('what the board knows, and when', () => {
  it('reports a day count for every source it has a stamp for', () => {
    const ages = dataAges(stamps(), NOW);
    expect(ages.map((source) => source.key)).toEqual(['market', 'research', 'pool', 'identity']);
    expect(ages.every((source) => source.days != null)).toBe(true);
    expect(ages.find((source) => source.key === 'market')?.days).toBe(3);
    expect(ages.find((source) => source.key === 'identity')?.days).toBe(7);
  });

  it('says nothing rather than guessing when a source never said', () => {
    const ages = dataAges(stamps({ research: null, market: null }), NOW);
    expect(ages.find((source) => source.key === 'research')?.days).toBeNull();
    expect(ages.find((source) => source.key === 'market')?.days).toBeNull();
  });

  it('bands only the market, because it is the only decay anybody measured', () => {
    // Inventing a threshold for the rest would spend the market's credibility
    // on a guess — the same reason `modelTrust` carries three blind spots and
    // not a dozen.
    const ages = dataAges(stamps(), NOW);
    expect(ages.find((source) => source.key === 'market')?.freshness).toBe('fresh');
    for (const source of ages.filter((s) => s.key !== 'market')) {
      expect(source.freshness).toBe('unknown');
    }
  });

  it('leads with the market only once it has actually gone off', () => {
    expect(stalest(dataAges(stamps(), NOW))).toBeNull();
    const old = stalest(dataAges(stamps({ market: { to: '2026-08-10' } }), NOW));
    expect(old?.text).toContain('23 days old');
    // A warning that does not say what to run about it costs attention and
    // buys nothing — and this one takes seconds, unlike the rebuild behind
    // everything else on the panel.
    expect(old?.refresh).toBe('npm run fetch:adp');
  });

  it('says nothing at all when there is no market to be stale', () => {
    expect(stalest(dataAges(stamps({ market: null }), NOW))).toBeNull();
  });
});
