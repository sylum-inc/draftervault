import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionDraftService } from '@/services/auctionDraftService';

/**
 * The half of scarcity that had never been counted.
 *
 * Everything else in a scarcity row is supply — how many are gone, how many are
 * left, what the drop costs — and supply on its own cannot say whether a
 * position is about to go. A run is demand arriving: seats the room still has
 * to fill, players left to fill them, and the money belonging to the teams
 * doing the filling. What is pinned here is that all three move with the draft,
 * because a reading that does not move is decoration.
 */
describe('demand against supply, per position', () => {
  let service: AuctionDraftService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuctionDraftService();
    service.seedHomeDefaults();
  });

  const row = (position: string) =>
    service.getMarketState().scarcity.find((entry) => entry.position === position)!;

  const best = (position: string, count = 1) =>
    service
      .getAvailablePlayers()
      .filter((player) => player.position === position)
      .sort((a, b) => b.projectedPoints - a.projectedPoints)
      .slice(0, count);

  it('opens at every team needing every dedicated seat', () => {
    // Twelve teams, one quarterback and three receivers each. The flex is
    // deliberately in none of them: it belongs to no position until somebody
    // spends it, and adding it to all three would count one seat as three.
    expect(row('QB').seatsLeft).toBe(12);
    expect(row('RB').seatsLeft).toBe(24);
    expect(row('WR').seatsLeft).toBe(36);
    expect(row('TE').seatsLeft).toBe(12);
  });

  it('reports the money as a rate, so the six rows are not six copies of the room', () => {
    const state = service.getMarketState();
    const rates = state.scarcity.map((entry) => entry.moneyPerSeat);
    expect(rates.every((rate) => rate !== null)).toBe(true);

    // Before anybody has bought anything every team has a seat open everywhere,
    // so the *total* money aimed at each position is the room's whole budget in
    // all six rows. Per seat they differ from the first frame, because the
    // seats do — and the whole point of the rate is that they do.
    expect(row('QB').moneyPerSeat).toBeCloseTo(row('WR').moneyPerSeat! * 3, 5);
    expect(row('RB').moneyPerSeat).toBeCloseTo(row('WR').moneyPerSeat! * 1.5, 5);
  });

  it('drops a team out of the row the moment its seat there is filled', () => {
    const opening = row('QB');
    const [quarterback] = best('QB');
    service.draftPlayer(quarterback.id, 'team-2', 30);

    const after = row('QB');
    expect(after.seatsLeft).toBe(opening.seatsLeft - 1);
    // Team 2 has its quarterback, so neither its seat nor its remaining $70 is
    // aimed here any more, however rich it is. Eleven teams, eleven seats, and
    // the $1,100 they are still holding.
    expect(Math.round(after.moneyPerSeat! * after.seatsLeft)).toBe(11 * 100);
  });

  it('is unmoved by a sale at its own position and moved by one anywhere else', () => {
    const opening = row('QB');
    const [quarterback] = best('QB');
    service.draftPlayer(quarterback.id, 'team-2', 30);

    // Worth pinning because it looks wrong and is not: a quarterback sale takes
    // a seat *and* the buyer's whole remaining budget out of this row together,
    // so a one-starter position holds its rate at a team's budget however
    // expensively it sells. What that means is that the rate is not a reading of
    // this position's own market — it is a reading of what the teams that still
    // need one can afford, and only spending elsewhere changes that.
    expect(row('QB').moneyPerSeat).toBeCloseTo(opening.moneyPerSeat!, 5);

    const [receiver] = best('WR');
    service.draftPlayer(receiver.id, 'team-3', 40);

    // Team 3 still needs a quarterback and now has $60 for it, so the money
    // aimed here falls without a single quarterback changing hands.
    const after = row('QB');
    expect(after.seatsLeft).toBe(11);
    expect(Math.round(after.moneyPerSeat! * after.seatsLeft)).toBe(11 * 100 - 40);
    expect(after.moneyPerSeat!).toBeLessThan(opening.moneyPerSeat!);
  });

  it('leaves the other positions' + ' money alone when the buyer still needs one there', () => {
    const opening = row('WR');
    const [quarterback] = best('QB');
    service.draftPlayer(quarterback.id, 'team-2', 30);

    const after = row('WR');
    // Team 2 still needs three receivers, so it is still in this row — with $30
    // less to spend. Seats here are untouched.
    expect(after.seatsLeft).toBe(opening.seatsLeft);
    expect(Math.round(after.moneyPerSeat! * after.seatsLeft)).toBe(12 * 100 - 30);
  });

  it('says nothing rather than nought once the room has no seat left here', () => {
    for (const team of service.getTeams()) {
      const [kicker] = best('K');
      service.draftPlayer(kicker.id, team.id, 1);
    }

    const kickers = row('K');
    expect(kickers.seatsLeft).toBe(0);
    // Null, not 0: no money is aimed here because nobody needs one, which is a
    // different statement from the teams that need one being broke.
    expect(kickers.moneyPerSeat).toBeNull();
  });

  it('counts the players left to fill those seats, however they left the board', () => {
    const opening = row('RB');
    expect(opening.startableLeft).toBeGreaterThan(0);

    const [back] = best('RB');
    service.draftPlayer(back.id, 'team-3', 40);
    expect(row('RB').startableLeft).toBe(opening.startableLeft - 1);
  });

  it('says nothing about a squeeze before anybody has drafted', () => {
    // The reading that had to be earned. Kicker and defence are regressed so
    // hard that the pool holds barely one startable one per club, so the seats
    // meet the players in the opening frame and never part — a bare
    // `seats >= players` test lights both red on the first render and stays red
    // for the whole night, which is a permanent alarm rather than a reading.
    for (const entry of service.getMarketState().scarcity) {
      expect(entry.squeeze).toBe('none');
    }
    const kickers = row('K');
    expect(kickers.seatsLeft).toBeGreaterThanOrEqual(kickers.startableLeft);
  });

  it('never squeezes a position that opened with no slack, however far it goes', () => {
    // Six kickers off the board takes six seats and six players together, so
    // the difference this would otherwise fire on is exactly as it was.
    best('K', 6).forEach((kicker, index) => service.draftPlayer(kicker.id, `team-${index + 1}`, 1));
    expect(row('K').squeeze).toBe('none');
  });

  it('shows the squeeze arriving: seats catching the players left to fill them', () => {
    const opening = row('TE');
    const startableGap = opening.startableLeft - opening.seatsLeft;
    expect(startableGap).toBeGreaterThan(0);

    // Buying tight ends takes a seat *and* a player, so the gap closes at twice
    // the rate either number moves — which is why this is the reading that
    // shows before a run rather than after it.
    const ends = best('TE', 4);
    ends.forEach((end, index) => service.draftPlayer(end.id, `team-${index + 1}`, 5));

    const after = row('TE');
    expect(after.seatsLeft).toBe(opening.seatsLeft - 4);
    expect(after.startableLeft).toBe(opening.startableLeft - 4);
    expect(after.startableLeft - after.seatsLeft).toBe(startableGap);
  });

  it('escalates as the slack a position opened with is spent', () => {
    // Slack is invariant under an ordinary sale: a team that needs a tight end
    // takes a seat and a player together. What spends it is a *backup* — a
    // second one to a team already covered — which is exactly what a run is
    // made of and the reason this reading shows before a run rather than after.
    expect(row('TE').squeeze).toBe('none');

    const seen: string[] = [];
    for (let pick = 0; pick < 12; pick += 1) {
      const [end] = best('TE');
      // Teams one to three, so every pick after the first three is a backup and
      // no team is asked to carry more than the position limit allows.
      service.draftPlayer(end.id, `team-${(pick % 3) + 1}`, 1);
      seen.push(row('TE').squeeze);
    }

    // Seats never emptied, so nothing here is the trivial "nobody needs one".
    expect(row('TE').seatsLeft).toBeGreaterThan(0);
    expect(seen.indexOf('some')).toBeGreaterThan(-1);
    expect(seen.indexOf('high')).toBeGreaterThan(seen.indexOf('some'));
    expect(seen.at(-1)).toBe('high');
  });
});
