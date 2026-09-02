import { describe, it, expect } from 'vitest';
import {
  canonicalUrl,
  citedUrls,
  freshnessDays,
  parseReply,
  validateResearch,
  OLDEST_USEFUL,
} from '@/lib/researchContract';

/**
 * These tests are the contract.
 *
 * Everything the research panel shows arrives from a language model that was
 * asked to be honest, which is not the same as being unable to be otherwise.
 * The only thing standing between a fabricated injury report and a $40 bid is
 * this validator, so it is tested the way an adversary would probe it: with
 * replies that are shaped correctly and wrong.
 */

const NOW = '2026-08-29';

/** A response message with the citation list a real search would have added. */
const cited = (...urls: string[]) => ({
  annotations: urls.map((url) => ({ type: 'url_citation', url_citation: { url, title: 'x' } })),
});

const finding = (over: Record<string, unknown> = {}) => ({
  claim: 'He was limited in practice on Wednesday.',
  url: 'https://espn.com/nfl/story/_/id/1',
  published: '2026-08-20',
  impact: 'NEGATIVE',
  ...over,
});

describe('canonicalUrl', () => {
  it('reduces a URL to the host and path that identify the page', () => {
    expect(canonicalUrl('https://www.ESPN.com/nfl/story/?utm_source=x#top')).toBe(
      'espn.com/nfl/story'
    );
  });

  it('treats a trailing slash and a query string as the same page', () => {
    expect(canonicalUrl('https://espn.com/a/b/')).toBe(
      canonicalUrl('http://www.espn.com/a/b?ref=1')
    );
  });

  it('refuses anything that is not http', () => {
    // A javascript: or data: URL rendered as a source link is an attack, not a
    // citation, and there is no reason a search engine would ever return one.
    expect(canonicalUrl('javascript:alert(1)')).toBeNull();
    expect(canonicalUrl('data:text/html,<b>hi</b>')).toBeNull();
    expect(canonicalUrl('not a url')).toBeNull();
    expect(canonicalUrl(null)).toBeNull();
  });
});

describe('parseReply', () => {
  it('reads a bare JSON object', () => {
    expect(parseReply('{"direction":"FADE"}')).toEqual({ direction: 'FADE' });
  });

  it('reads one wrapped in a code fence, which models add unbidden', () => {
    expect(parseReply('```json\n{"direction":"PAY_UP"}\n```')).toEqual({ direction: 'PAY_UP' });
  });

  it('reads one buried in a sentence of preamble', () => {
    expect(parseReply('Here is what I found:\n{"headline":"ok"}\nHope that helps.')).toEqual({
      headline: 'ok',
    });
  });

  it('returns null rather than throwing, so one bad reply costs one player', () => {
    expect(parseReply('I could not find anything.')).toBeNull();
    expect(parseReply('{ broken')).toBeNull();
    expect(parseReply(undefined)).toBeNull();
  });
});

describe('validateResearch', () => {
  it('keeps a finding whose URL the search engine actually returned', () => {
    const result = validateResearch(
      {
        direction: 'FADE',
        confidence: 'HIGH',
        headline: 'Limited in practice',
        findings: [finding()],
      },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1')),
      NOW
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].source).toBe('espn.com');
    expect(result.direction).toBe('FADE');
    expect(result.dropped).toEqual({ unsourced: 0, undated: 0, malformed: 0 });
  });

  it('drops a claim citing a URL that was never returned, however plausible', () => {
    // This is the whole point. The URL below is well-formed, on a real domain,
    // and describes exactly the kind of page that would carry the claim. It is
    // also not in the citation list, which means nobody has seen it.
    const result = validateResearch(
      {
        direction: 'FADE',
        confidence: 'HIGH',
        headline: 'Hamstring',
        findings: [finding({ url: 'https://www.espn.com/nfl/story/_/id/99999/injury-report' })],
      },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1')),
      NOW
    );

    expect(result.findings).toHaveLength(0);
    expect(result.dropped.unsourced).toBe(1);
  });

  it('takes the position down with the sources when nothing survives', () => {
    // A confident FADE with no evidence left under it is worse than nothing,
    // because it reads identically to one with evidence.
    const result = validateResearch(
      {
        direction: 'FADE',
        confidence: 'HIGH',
        headline: 'Expect a reduced role',
        findings: [finding({ url: 'https://invented.example/report' })],
      },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1')),
      NOW
    );

    expect(result.direction).toBe('NEUTRAL');
    expect(result.confidence).toBe('LOW');
    expect(result.headline).toBe('');
  });

  it('stores the engine URL, not the one the model retyped', () => {
    const result = validateResearch(
      { findings: [finding({ url: 'http://WWW.espn.com/nfl/story/_/id/1/' })] },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1?src=api')),
      NOW
    );

    expect(result.findings[0].url).toBe('https://espn.com/nfl/story/_/id/1?src=api');
  });

  it('drops a finding with no usable publication date', () => {
    const allowed = citedUrls(cited('https://espn.com/nfl/story/_/id/1'));
    for (const published of ['', 'last week', '2026-8-2', '2026-13-01']) {
      expect(
        validateResearch({ findings: [finding({ published })] }, allowed, NOW).dropped.undated
      ).toBe(1);
    }
  });

  it('drops a date in the future and one older than the tape', () => {
    const allowed = citedUrls(cited('https://espn.com/nfl/story/_/id/1'));
    expect(
      validateResearch({ findings: [finding({ published: '2027-01-01' })] }, allowed, NOW).dropped
        .undated
    ).toBe(1);
    expect(
      validateResearch({ findings: [finding({ published: '2019-09-01' })] }, allowed, NOW).dropped
        .undated
    ).toBe(1);
    expect(OLDEST_USEFUL < NOW).toBe(true);
  });

  it('counts a claim-less finding as malformed rather than silently ignoring it', () => {
    const result = validateResearch(
      { findings: [finding({ claim: '   ' })] },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1')),
      NOW
    );
    expect(result.dropped.malformed).toBe(1);
  });

  it('strips a headline carrying a figure, because that can only be a valuation', () => {
    const result = validateResearch(
      { direction: 'PAY_UP', headline: 'Worth $45 now that he has the job', findings: [finding()] },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1')),
      NOW
    );
    expect(result.headline).toBe('');
    // The finding itself survives — only the priced summary goes.
    expect(result.findings).toHaveLength(1);
  });

  it('will not let pure background argue for a move', () => {
    const result = validateResearch(
      {
        direction: 'PAY_UP',
        confidence: 'HIGH',
        headline: 'New coordinator',
        findings: [finding({ impact: 'CONTEXT' })],
      },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1')),
      NOW
    );
    expect(result.direction).toBe('NEUTRAL');
    expect(result.headline).toBe('New coordinator');
  });

  it('collapses the same claim cited twice', () => {
    const result = validateResearch(
      { findings: [finding(), finding()] },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1')),
      NOW
    );
    expect(result.findings).toHaveLength(1);
  });

  it('orders findings newest first', () => {
    const result = validateResearch(
      {
        findings: [
          finding({ claim: 'older', published: '2026-03-01' }),
          finding({ claim: 'newer', published: '2026-08-01' }),
        ],
      },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1')),
      NOW
    );
    expect(result.findings.map((f) => f.claim)).toEqual(['newer', 'older']);
  });

  it('falls back to NEUTRAL on an unrecognised direction rather than passing it through', () => {
    const result = validateResearch(
      { direction: 'BUY', confidence: 'CERTAIN', findings: [finding()] },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1')),
      NOW
    );
    expect(result.direction).toBe('NEUTRAL');
    expect(result.confidence).toBe('LOW');
  });

  it('survives a reply that is nothing like the schema', () => {
    const empty = validateResearch(null, new Map(), NOW);
    expect(empty.findings).toEqual([]);
    expect(empty.direction).toBe('NEUTRAL');
    expect(validateResearch({ findings: 'lots' }, new Map(), NOW).findings).toEqual([]);
  });
});

describe('citedUrls', () => {
  it('reads the OpenAI-standard annotation shape', () => {
    expect(citedUrls(cited('https://www.nfl.com/news/a/')).get('nfl.com/news/a')).toBe(
      'https://www.nfl.com/news/a/'
    );
  });

  it('is empty when a response carried no search results', () => {
    expect(citedUrls({}).size).toBe(0);
    expect(citedUrls(null).size).toBe(0);
    expect(citedUrls({ annotations: 'none' }).size).toBe(0);
  });
});

describe('freshnessDays', () => {
  it('measures from the newest source', () => {
    const research = validateResearch(
      { findings: [finding({ published: '2026-08-20' })] },
      citedUrls(cited('https://espn.com/nfl/story/_/id/1')),
      NOW
    );
    expect(freshnessDays(research, new Date('2026-08-29T12:00:00Z'))).toBe(9);
  });

  it('is null when there is nothing to be fresh about', () => {
    expect(
      freshnessDays({
        direction: 'NEUTRAL',
        confidence: 'LOW',
        headline: '',
        findings: [],
        dropped: { unsourced: 0, undated: 0, malformed: 0 },
      })
    ).toBeNull();
  });
});

/**
 * A page that cannot hold still cannot carry a dated claim.
 *
 * Found by re-fetching citations rather than by reasoning about them. Two of
 * two hundred and thirty cited a player hub — CBS Sports' Javonte Williams
 * page, and a rolling news index — and the CBS one carried a finding stamped
 * 11 August about content the page itself dates to 27 April, inside a block
 * that will be rewritten next week. Both claims happened to be true. The
 * defect is that nothing in the pipeline could have told, because the date on
 * the finding could only have come from the model: the page has none.
 *
 * It is the same objection as "the model's URL is never trusted", one level
 * in. There the URL was checked against what the search actually returned;
 * here the URL is real and it is the *date* that has nothing behind it.
 */
describe('citations that cannot be dated', () => {
  // Built the way the pipeline builds it, so the canonicalisation is the same
  // one the real allowlist goes through rather than a second reading of it.
  const allow = (url: string) => citedUrls({ annotations: [{ url_citation: { url } }] });
  const finding = (url: string) => ({
    direction: 'PAY_UP',
    confidence: 'MEDIUM',
    headline: 'something happened',
    findings: [{ claim: 'a claim about a player', url, published: '2026-08-11', impact: 'ROLE' }],
  });

  it('refuses a player hub, an injury history and a rolling news index', () => {
    for (const url of [
      'https://www.cbssports.com/nfl/players/2961719/javonte-williams/',
      'https://www.draftsharks.com/fantasy/injury-history/amon-ra-st-brown/10783',
      'https://fantasyfootballcalculator.com/players/jakobi-meyers/news',
      'https://www.foxsports.com/nfl/some-guy-player-injuries/depth-chart/',
    ]) {
      const out = validateResearch(finding(url), allow(url), '2026-08-31');
      expect(out.findings).toHaveLength(0);
      // Counted as undated, because that is exactly what it is.
      expect(out.dropped.undated).toBe(1);
    }
  });

  it('still takes an ordinary dated article', () => {
    const url = 'https://www.si.com/nfl/lions/onsi/why-detroit-lions-wont-miss-montgomery-2026';
    const out = validateResearch(finding(url), allow(url), '2026-08-31');
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].source).toBe('si.com');
  });

  it('does not mistake a path that merely contains the letters', () => {
    // `/playersunion/` and `/teams-of-the-week/` are articles, not hubs — the
    // rule matches a path *segment* rather than a substring.
    const url = 'https://www.nfl.com/news/playersunion-teams-of-the-week-report-2026';
    const out = validateResearch(finding(url), allow(url), '2026-08-31');
    expect(out.findings).toHaveLength(1);
  });
});
