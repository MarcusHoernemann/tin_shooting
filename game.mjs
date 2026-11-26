export const SHELVES = [
  [[20, 1], [19, 2], [18, 3]],
  [[16, 2], [15, 1], [17, 2]],
  [[10, 1], [14, 3], [12, 1]],
  [[7, 3], [9, 2], [11, 1]],
  [[3, 2], [5, 3], [1, 1]],
  [[25, 2], [13, 2], [20, 3]],
];
export const DARTS_PER_TURN = 3;
export const CAN_POINTS = 100;
export const CLEAR_BONUS = 50;

export function tally(match) {
  const rounds = SHELVES.map(shelf => match.players.map(() => ({
    cans: shelf.map(([field, strength]) => ({ field, strength, remaining: strength })),
    darts: [],
    points: 0,
  })));
  let turn = 0;
  for (const dart of match.darts) {
    const round = Math.floor(turn / match.players.length);
    const player = turn % match.players.length;
    if (round === SHELVES.length) break;
    const entry = rounds[round][player];
    entry.darts.push(dart);
    const can = entry.cans.find(target => target.field === dart.field && target.remaining > 0);
    if (can) {
      can.remaining = Math.max(0, can.remaining - dart.multiplier);
      if (can.remaining === 0) {
        entry.points += CAN_POINTS;
        if (entry.cans.every(target => target.remaining === 0)) entry.points += CLEAR_BONUS;
      }
    }
    if (entry.darts.length === DARTS_PER_TURN) turn += 1;
  }
  const scores = match.players.map((_, player) =>
    rounds.reduce((total, round) => total + round[player].points, 0));
  return {
    round: Math.floor(turn / match.players.length),
    player: turn % match.players.length,
    done: turn === SHELVES.length * match.players.length,
    scores,
    rounds,
  };
}

export function formatDart({ field, multiplier }) {
  if (!field) return 'Fehlwurf';
  if (field === 25) return multiplier === 2 ? 'Bullseye' : 'Bull';
  return ['','S','D','T'][multiplier] + field;
}
