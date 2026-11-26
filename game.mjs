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
const PREVIOUS_LEVELS = [
  { count: 5, strength: 3, points: 100 },
  { count: 4, strength: 2, points: 150 },
  { count: 3, strength: 1, points: 200 },
];

const STACK_LEVELS = [3, 2, 1].map(count => ({ count, strength: 3 }));

function buildTower(matchId, towerNumber, stack) {
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
  const levels = stack ? STACK_LEVELS : PREVIOUS_LEVELS;
  return levels.map(({ count, strength, points }, level) => Array.from({ length: count }, (_, index) => {
    const field = fields.pop();
    const required = !stack && field === 25 ? Math.min(strength, 2) : strength;
    return { field, strength: required, remaining: required, points, slot: level + '-' + index };
  }));
}

function applyHit(rows, dart, stack) {
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
      const leftStanding = supports[index].remaining > 0;
      const rightStanding = supports[index + 1].remaining > 0;
      const supported = stack ? leftStanding && rightStanding : leftStanding || rightStanding;
      if (supported) return;
      can.remaining = 0;
      fallen.push(can);
    });
  }
  return fallen;
}

function tallyTower(match, stack) {
  const playerCount = match.players.length;
  const limit = ROUNDS * playerCount * DARTS_PER_TURN;
  const scores = match.players.map(() => 0);
  let towerNumber = 1;
  let rows = buildTower(match.id, towerNumber, stack);
  let lastFall = null;
  const darts = match.darts.slice(0, limit);

  for (let index = 0; index < darts.length; index += 1) {
    const player = Math.floor(index / DARTS_PER_TURN) % playerCount;
    const fallen = applyHit(rows, darts[index], stack);
    if (!fallen.length) {
      lastFall = null;
      continue;
    }
    const points = fallen.reduce((sum, can, position) => {
      if (!stack) return sum + can.points;
      const multiplier = position === 0 ? darts[index].multiplier : 3;
      return sum + can.field * multiplier;
    }, 0);
    scores[player] += points;
    const cleared = rows.every(row => row.every(can => !can.remaining));
    lastFall = { player, points, count: fallen.length, cleared, towerNumber, slots: fallen.map(can => can.slot) };
    if (cleared && index + 1 < limit) {
      towerNumber += 1;
      rows = buildTower(match.id, towerNumber, stack);
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
  if (match.mode === 'stack') return tallyTower(match, true);
  if (match.mode === 'tower') return tallyTower(match, false);
  return tallyShelves(match);
}

export function formatDart({ field, multiplier }) {
  if (!field) return 'Fehlwurf';
  if (field === 25) return multiplier === 2 ? 'Bullseye' : 'Bull';
  return ['','S','D','T'][multiplier] + field;
}
