const SHELVES = [
  [[20, 1], [19, 2], [18, 3]],
  [[16, 2], [15, 1], [17, 2]],
  [[10, 1], [14, 3], [12, 1]],
  [[7, 3], [9, 2], [11, 1]],
  [[3, 2], [5, 3], [1, 1]],
  [[25, 2], [13, 2], [20, 3]],
];
export const DARTS_PER_TURN = 3;
const CAN_POINTS = 100;
const CLEAR_BONUS = 50;

function tallyShelves(match) {
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
  const round = Math.floor(turn / match.players.length);
  const player = turn % match.players.length;
  const current = rounds[round]?.[player];
  return {
    round, player, done: !current, scores,
    roundCount: SHELVES.length,
    rows: current ? [current.cans] : [],
    currentDarts: current?.darts ?? [],
  };
}

export const ROUNDS = 7;
const LEVELS = [
  { count: 5, strength: 3, points: 100 },
  { count: 4, strength: 2, points: 150 },
  { count: 3, strength: 1, points: 200 },
];

function buildTower(matchId, towerNumber) {
  // A replay, a reload and undo must all produce the same targets.
  let seed = 2166136261;
  for (const character of matchId + ':' + towerNumber) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  const fields = Array.from({ length: 20 }, (_, index) => index + 1);
  fields.push(25);
  for (let index = fields.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const other = seed % (index + 1);
    [fields[index], fields[other]] = [fields[other], fields[index]];
  }
  return LEVELS.map(({ count, strength, points }) => Array.from({ length: count }, () => {
    const field = fields.pop();
    const required = field === 25 ? Math.min(strength, 2) : strength;
    return { field, strength: required, remaining: required, points };
  }));
}

function applyHit(rows, dart) {
  const target = rows.flat().find(can => can.remaining > 0 && can.field === dart.field);
  if (!target) return [];
  target.remaining = Math.max(0, target.remaining - dart.multiplier);
  if (target.remaining) return [];
  const fallen = [target];

  // Each higher can sits between two directly adjacent cans in the row below.
  for (let level = 1; level < rows.length; level += 1) {
    rows[level].forEach((can, index) => {
      if (!can.remaining) return;
      const supports = rows[level - 1];
      if (supports[index].remaining || supports[index + 1].remaining) return;
      can.remaining = 0;
      fallen.push(can);
    });
  }
  return fallen;
}

function tallyTower(match) {
  const playerCount = match.players.length;
  const limit = ROUNDS * playerCount * DARTS_PER_TURN;
  const scores = match.players.map(() => 0);
  let towerNumber = 1;
  let rows = buildTower(match.id, towerNumber);
  let lastFall = null;
  const darts = match.darts.slice(0, limit);

  for (let index = 0; index < darts.length; index += 1) {
    const player = Math.floor(index / DARTS_PER_TURN) % playerCount;
    const fallen = applyHit(rows, darts[index]);
    if (!fallen.length) {
      lastFall = null;
      continue;
    }
    const points = fallen.reduce((sum, can) => sum + can.points, 0);
    scores[player] += points;
    const cleared = rows.every(row => row.every(can => !can.remaining));
    lastFall = { player, points, count: fallen.length, cleared };
    if (cleared && index + 1 < limit) {
      towerNumber += 1;
      rows = buildTower(match.id, towerNumber);
    }
  }

  const turn = Math.floor(darts.length / DARTS_PER_TURN);
  return {
    round: Math.floor(turn / playerCount),
    player: turn % playerCount,
    roundCount: ROUNDS,
    done: darts.length === limit,
    scores,
    rows,
    towerNumber,
    lastFall,
    currentDarts: darts.slice(turn * DARTS_PER_TURN),
  };
}

export function tally(match) {
  return match.mode === 'tower' ? tallyTower(match) : tallyShelves(match);
}

export function formatDart({ field, multiplier }) {
  if (!field) return 'Fehlwurf';
  if (field === 25) return multiplier === 2 ? 'Bullseye' : 'Bull';
  return ['','S','D','T'][multiplier] + field;
}
