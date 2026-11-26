import { formatDart, tally, DARTS_PER_TURN } from './game.mjs';

const $ = id => document.getElementById(id);
const storageKey = 'tin-shooting-v1';
const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const views = ['play', 'players', 'history', 'rules'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function applyCurrentScoring(match) {
  if (match?.mode === 'stack' && !match.scoring) match.scoring = 'every-hit';
}

function readData() {
  const defaults = { profiles: [], selected: [], match: null, history: [], lastUse: null };
  try {
    const saved = { ...defaults, ...JSON.parse(localStorage.getItem(storageKey)) };
    const match = saved.match;
    if (match?.mode === 'stack' && !match.scoring && !tally(match).done) applyCurrentScoring(match);
    return saved;
  } catch {
    return defaults;
  }
}

const data = readData();
let ring = 1;
let view = 'play';

function showMessage(message = '') {
  $('feedback').textContent = message;
  $('feedback').hidden = !message;
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
  } catch {
    showMessage('Der lokale Speicher ist nicht verfügbar. Deine Änderungen gelten nur in dieser Sitzung.');
    return false;
  }
}

function element(tag, className, label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label !== undefined) node.textContent = label;
  return node;
}

function button(label, className, action) {
  const node = element('button', className, label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function showView(next) {
  view = next;
  for (const name of views) $(name).hidden = name !== view;
  for (const nav of document.querySelectorAll('nav [data-view]')) {
    if (nav.dataset.view === view) nav.setAttribute('aria-current', 'page');
    else nav.removeAttribute('aria-current');
  }
  render();
  $('main').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function render() {
  if (view === 'players') renderPlayers();
  if (view === 'history') renderHistory();
  if (view === 'play') {
    $('lobby').hidden = Boolean(data.match);
    $('match').hidden = !data.match;
    if (data.match) renderMatch();
    else renderSelection();
  }
}

function renderSelection() {
  const selection = $('selection');
  const focusedId = selection.contains(document.activeElement) ? document.activeElement.value : null;
  selection.replaceChildren();
  $('selectionCount').textContent = data.profiles.length ? data.selected.length + ' von 8 ausgewählt' : 'Noch keine Spieler gespeichert.';
  $('start').disabled = !data.selected.length;
  for (const profile of data.profiles) {
    const position = data.selected.indexOf(profile.id);
    const label = element('label', 'pick');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = profile.id;
    input.setAttribute('aria-label', profile.name);
    if (position >= 0) input.setAttribute('aria-description', 'Wurfposition ' + (position + 1));
    input.checked = position >= 0;
    input.disabled = position < 0 && data.selected.length === 8;
    input.addEventListener('change', () => {
      if (input.checked) data.selected.push(profile.id);
      else data.selected = data.selected.filter(id => id !== profile.id);
      save();
      renderSelection();
    });
    label.append(input, element('span', 'pick-name', profile.name));
    if (position >= 0) label.append(element('span', 'pick-order', position + 1));
    selection.append(label);
    if (focusedId === profile.id) input.focus();
  }
}

function wireAdd(formId, inputId, selectNew) {
  $(formId).addEventListener('submit', event => {
    event.preventDefault();
    const input = $(inputId);
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (!name) return showMessage('Gib einen Spielernamen ein.');
    const existing = data.profiles.find(profile =>
      profile.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));
    if (existing) {
      showMessage('Dieser Name ist bereits gespeichert.');
      return;
    }
    const profile = { id: crypto.randomUUID(), name };
    data.profiles.push(profile);
    if (selectNew && data.selected.length < 8) data.selected.push(profile.id);
    if (save()) showMessage(name + ' wurde gespeichert.');
    input.value = '';
    render();
    input.focus();
  });
}

function renderPlayers() {
  $('playerList').replaceChildren();
  if (!data.profiles.length) $('playerList').append(element('li', 'empty', 'Noch keine Spieler gespeichert.'));
  for (const profile of data.profiles) {
    const row = element('li', 'row');
    const remove = button('Löschen', 'danger', () => {
      if (!confirm('Spieler „' + profile.name + '“ aus der Liste löschen?')) return;
      data.profiles = data.profiles.filter(entry => entry.id !== profile.id);
      data.selected = data.selected.filter(id => id !== profile.id);
      if (save()) showMessage(profile.name + ' wurde aus der Spielerliste gelöscht.');
      renderPlayers();
      $('playerName').focus();
    });
    remove.setAttribute('aria-label', profile.name + ' löschen');
    row.append(element('strong', 'player-name', profile.name), remove);
    $('playerList').append(row);
  }
}

function startMatch() {
  const players = data.selected.map(id => data.profiles.find(profile => profile.id === id)?.name).filter(Boolean);
  if (!players.length) return;
  data.match = { id: crypto.randomUUID(), mode: 'stack', scoring: 'every-hit', players, darts: [] };
  data.lastUse = new Date().toISOString();
  ring = 1;
  showMessage();
  save();
  render();
  $('turnTitle').focus();
}

function renderMatch() {
  const match = data.match;
  const state = tally(match);
  $('round').textContent = state.done ? 'Endstand' : 'Runde ' + (state.round + 1) + ' von ' + state.roundCount;
  const stack = match.mode === 'stack';
  const isTower = stack || match.mode === 'tower';
  $('cans').classList.toggle('tower', isTower);
  $('cans').classList.toggle('stack', stack);
  $('cans').hidden = state.done;
  $('legacyNotice').hidden = stack || state.done;
  $('towerLabel').hidden = !isTower || state.done;
  $('towerLabel').textContent = isTower ? 'Turm ' + state.towerNumber : '';
  const fall = state.lastFall;
  const hit = state.lastHit;
  $('lastFall').hidden = !fall && !hit;
  if (fall) {
    const cans = fall.count === 1 ? '1 Dose' : fall.count + ' Dosen';
    const notice = fall.cleared ? ' · Turm abgeräumt' : '';
    $('lastFall').textContent = match.players[fall.player] + ': ' + cans + ', +' + fall.points + ' P' + notice;
  } else if (hit) {
    $('lastFall').textContent = match.players[hit.player] + ': ' + formatDart(hit.dart) + ', +' + hit.points + ' P';
  } else {
    $('lastFall').textContent = '';
  }
  $('controls').hidden = state.done;
  $('cancelMatch').hidden = state.done;
  $('restart').hidden = !state.done;
  $('cans').replaceChildren();
  renderDarts(state.done ? match.darts.slice(-DARTS_PER_TURN) : state.currentDarts);

  if (state.done) {
    const highest = Math.max(...state.scores);
    const winners = match.players.filter((_, index) => state.scores[index] === highest);
    $('turnTitle').textContent = match.players.length === 1 ? highest + ' Punkte' :
      winners.length === 1 ? winners[0] + ' gewinnt' : 'Gleichstand: ' + winners.join(', ');
  } else {
    $('turnTitle').textContent = match.players[state.player] + ' wirft';
    renderCans(state.rows, isTower, stack, state.towerNumber);
    const activeNumbers = new Set(state.rows.flat().filter(can => can.remaining > 0).map(can => can.field));
    for (const numberButton of $('controls').querySelectorAll('[data-field]')) {
      numberButton.classList.toggle('available', activeNumbers.has(Number(numberButton.dataset.field)));
    }
  }

  const order = match.players.map((_, index) => index);
  if (state.done) order.sort((a, b) => state.scores[b] - state.scores[a]);
  $('scores').replaceChildren();
  for (const index of order) {
    const score = element('li', 'score');
    const current = !state.done && index === state.player;
    if (current) score.setAttribute('aria-current', 'true');
    score.append(element('span', 'player-name', match.players[index]), element('strong', '', state.scores[index] + ' P'));
    $('scores').append(score);
  }
  $('undo').disabled = !match.darts.length;
  $('undoFinal').hidden = !state.done;
  setRing(ring);
}

function dartSymbols(darts) {
  const symbols = document.createDocumentFragment();
  for (let index = 0; index < DARTS_PER_TURN; index += 1) {
    const dart = darts[index];
    const description = 'Dart ' + (index + 1) + (dart ? ': ' + formatDart(dart) : ': bereit');
    const chip = element('span', dart ? 'dart entered' : 'dart');
    chip.title = description;
    const icon = element('span', 'dart-icon');
    icon.setAttribute('aria-hidden', 'true');
    chip.append(icon, element('span', 'sr-only', description));
    symbols.append(chip);
  }
  return symbols;
}

function renderDarts(darts) {
  $('turnDarts').replaceChildren(dartSymbols(darts));
}

function animateCompletedTurn(darts) {
  if (reducedMotion.matches || typeof Element.prototype.animate !== 'function') return;
  const overlay = element('div', 'dart-transition');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.append(dartSymbols(darts));
  $('turnDarts').append(overlay);
  const fade = overlay.animate([
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: .55 },
    { opacity: 0, offset: 1 },
  ], { duration: 330, easing: 'ease-out' });
  fade.finished.then(() => overlay.remove(), () => overlay.remove());
}

function renderCans(rows, isTower, stack, towerNumber) {
  const colors = ['coral', 'cyan', 'gold', 'green', 'violet', 'rose'];
  const levels = ['Untere Reihe', 'Mittlere Reihe', 'Obere Reihe'];
  for (let level = rows.length - 1; level >= 0; level -= 1) {
    const row = element('div', 'can-row');
    if (isTower) {
      row.dataset.level = level;
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', levels[level]);
    }
    const cans = rows[level];
    const standing = cans.filter(can => can.remaining > 0);
    cans.forEach((can, index) => {
      const target = element('div', 'target');
      target.classList.toggle('down', can.remaining === 0);
      const fieldName = can.field === 25 ? 'Bull' : String(can.field);
      const graphic = element('div', 'can target-can');
      graphic.setAttribute('aria-hidden', 'true');
      graphic.append(element('strong', 'can-number', fieldName));
      if (stack) {
        graphic.dataset.color = colors[[0, 3, 5][level] + index];
        graphic.dataset.canKey = towerNumber + ':' + can.slot;
        if (can.remaining) {
          const original = index - (cans.length - 1) / 2;
          const settled = standing.indexOf(can) - (standing.length - 1) / 2;
          target.style.setProperty('--slide', (settled - original) * 60 + '%');
        }
        const rings = element('div', 'can-bands');
        for (let ringIndex = 0; ringIndex < can.strength; ringIndex += 1) {
          rings.append(element('span', ringIndex >= can.strength - can.remaining ? 'can-band' : 'can-band spent'));
        }
        graphic.append(rings);
      } else if (isTower) {
        graphic.append(element('small', 'can-value', can.points + ' P'));
      }
      const description = isTower && !stack ? fieldName + ', ' + can.points + ' Punkte. ' : fieldName + '. ';
      const remaining = can.remaining ? can.remaining + (stack ? ' Ringe offen.' : ' Trefferpunkte offen.') : 'Gefallen.';
      target.append(graphic, element('span', 'sr-only', description + remaining));
      if (!stack) {
        const status = can.remaining ? can.remaining + '/' + can.strength : 'Gefallen';
        const marker = element('span', 'can-status', status);
        marker.setAttribute('aria-hidden', 'true');
        target.append(marker);
      }
      row.append(target);
    });
    $('cans').append(row);
  }
}

function setRing(value) {
  ring = value;
  for (const node of $('rings').querySelectorAll('button')) {
    node.setAttribute('aria-pressed', String(Number(node.dataset.ring) === ring));
  }
}

function stackPositions() {
  const positions = new Map();
  for (const can of $('cans').querySelectorAll('.target:not(.down) [data-can-key]')) {
    positions.set(can.dataset.canKey, { can, bounds: can.getBoundingClientRect() });
  }
  return positions;
}

function launchCan({ can, bounds }, direction, delay) {
  if (!bounds.width || bounds.bottom < 0 || bounds.top >= innerHeight) return;
  const piece = can.cloneNode(true);
  piece.classList.add('flying-can');
  Object.assign(piece.style, {
    left: bounds.left + 'px', top: bounds.top + 'px',
    width: bounds.width + 'px', height: bounds.height + 'px',
  });
  $('flightLayer').append(piece);
  const distance = Math.min(145, innerWidth * .32);
  const drop = Math.min(270, innerHeight * .35);
  const flight = piece.animate([
    { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(.18,.68,.4,1)' },
    { transform: 'translate(' + direction * distance * .27 + 'px, -35px) rotate(' + direction * 50 + 'deg)', offset: .28, easing: 'cubic-bezier(.55,.03,.9,.66)' },
    { transform: 'translate(' + direction * distance * .84 + 'px, ' + drop * .74 + 'px) rotate(' + direction * 220 + 'deg)', opacity: .9, offset: .76 },
    { transform: 'translate(' + direction * distance + 'px, ' + drop + 'px) rotate(' + direction * 320 + 'deg)', opacity: 0 },
  ], { duration: 730, delay, fill: 'backwards' });
  flight.finished.then(() => piece.remove(), () => piece.remove());
}

function animateStack(before, fall, nextTowerNumber) {
  fall?.slots.forEach((slot, index) => {
    const position = before.get(fall.towerNumber + ':' + slot);
    if (!position) return;
    const [level, column] = slot.split('-').map(Number);
    const middle = (2 - level) / 2;
    const direction = column === middle ? (index % 2 ? 1 : -1) : Math.sign(column - middle);
    launchCan(position, direction, index * 58);
  });
  for (const [key, next] of stackPositions()) {
    const prior = before.get(key);
    const shell = next.can.parentElement;
    if (prior) {
      const x = prior.bounds.left - next.bounds.left;
      const y = prior.bounds.top - next.bounds.top;
      if (Math.abs(x) + Math.abs(y) < 1) continue;
      shell.animate([
        { transform: 'translate(' + x + 'px, ' + y + 'px)' },
        { transform: 'translate(0, 0)' },
      ], { duration: 530, easing: 'cubic-bezier(.18,.76,.24,1)' });
    } else if (fall && nextTowerNumber !== fall.towerNumber) {
      const level = Number(key.split(':')[1][0]);
      shell.animate([
        { opacity: 0, transform: 'translateY(-22px)' },
        { opacity: 1, transform: 'translateY(3px)', offset: .76 },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 440, delay: 190 + level * 80, fill: 'backwards', easing: 'ease-out' });
    }
  }
}

function enterDart(field, multiplier) {
  const match = data.match;
  if (!match) return;
  const priorState = tally(match);
  if (priorState.done) return;
  const before = match.mode === 'stack' && !reducedMotion.matches && typeof Element.prototype.animate === 'function'
    ? stackPositions() : null;
  match.darts.push({ field, multiplier });
  ring = 1;
  data.lastUse = new Date().toISOString();
  const state = tally(match);
  if (state.done) {
    data.history = [{ id: match.id, at: data.lastUse, players: match.players, scores: state.scores }, ...data.history].slice(0, 30);
  }
  save();
  renderMatch();
  if (before) animateStack(before, state.lastFall, state.towerNumber);
  if (!state.done && priorState.currentDarts.length === DARTS_PER_TURN - 1) {
    animateCompletedTurn([...priorState.currentDarts, { field, multiplier }]);
  }
  if (state.done) $('restart').focus();
}

function undo() {
  if (!data.match?.darts.length) return;
  const finished = tally(data.match).done;
  data.match.darts.pop();
  applyCurrentScoring(data.match);
  data.history = data.history.filter(entry => entry.id !== data.match.id);
  ring = 1;
  save();
  renderMatch();
  if (finished || !data.match.darts.length) $('turnTitle').focus();
}

function renderHistory() {
  $('lastUse').textContent = data.lastUse ? 'Letzte Nutzung: ' + dateTime.format(new Date(data.lastUse)) : '';
  $('clearHistory').disabled = !data.history.length && !data.lastUse;
  $('historyList').replaceChildren();
  if (!data.history.length) $('historyList').append(element('li', 'empty', 'Noch keine abgeschlossenen Partien im Verlauf.'));
  for (const entry of data.history) {
    const row = element('li', 'history-item');
    const time = element('time', 'eyebrow', dateTime.format(new Date(entry.at)));
    time.dateTime = entry.at;
    const result = element('ul', 'history-scores');
    entry.players.map((_, index) => index).sort((a, b) => entry.scores[b] - entry.scores[a]).forEach(index => {
      const line = element('li', 'row');
      line.append(element('span', 'player-name', entry.players[index]), element('strong', '', entry.scores[index] + ' P'));
      result.append(line);
    });
    row.append(time, result);
    $('historyList').append(row);
  }
}

for (const item of document.querySelectorAll('[data-view]')) {
  item.addEventListener('click', () => { showMessage(); showView(item.dataset.view); });
}
wireAdd('quickAdd', 'quickName', true);
wireAdd('playersAdd', 'playerName', false);
$('start').addEventListener('click', startMatch);
$('restart').addEventListener('click', () => {
  data.match = null;
  save();
  showView('play');
});
$('cancelMatch').addEventListener('click', () => {
  if (!confirm('Laufende Partie abbrechen?')) return;
  data.match = null;
  save();
  showView('play');
});
$('undo').addEventListener('click', undo);
$('undoFinal').addEventListener('click', undo);
$('rings').addEventListener('click', event => {
  const target = event.target.closest('[data-ring]');
  if (target) setRing(Number(target.dataset.ring));
});
for (let field = 1; field <= 20; field += 1) {
  const node = element('button', '', field);
  node.dataset.field = field;
  $('fields').append(node);
}
$('controls').addEventListener('click', event => {
  const target = event.target.closest('[data-field]');
  if (target) enterDart(Number(target.dataset.field), Number(target.dataset.multiplier ?? ring));
});
$('clearHistory').addEventListener('click', () => {
  if (!confirm('Partieverlauf und Zeitpunkt der letzten Nutzung löschen?')) return;
  data.history = [];
  data.lastUse = null;
  if (data.match && tally(data.match).done) data.match = null;
  if (save()) showMessage('Verlauf gelöscht.');
  renderHistory();
});

window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  Object.assign(data, readData());
  ring = 1;
  render();
});
data.lastUse = new Date().toISOString();
save();
render();

let installPrompt;
const standalone = matchMedia('(display-mode: standalone)');
function reflectInstall() {
  $('install').hidden = standalone.matches || navigator.standalone === true;
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  reflectInstall();
});
window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  $('install').hidden = true;
});
standalone.addEventListener('change', reflectInstall);
reflectInstall();
$('install').addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = undefined;
    await prompt.prompt();
  } else {
    $('installHelp').showModal();
  }
});

let registration;
let applying = false;
function offerUpdate() {
  $('updateBanner').hidden = !(registration?.waiting && navigator.serviceWorker.controller);
}

async function checkUpdate(manual = false) {
  if (manual) showMessage();
  if (!registration) {
    if (manual) showMessage('Updates sind nach dem ersten Laden über HTTPS verfügbar.');
    return;
  }
  try {
    await registration.update();
    const installing = registration.installing;
    if (installing && ['installing', 'activating'].includes(installing.state)) {
      await new Promise(resolve => {
        installing.addEventListener('statechange', () => {
          if (!['installing', 'activating'].includes(installing.state)) resolve();
        });
      });
    }
    offerUpdate();
    if (manual && $('updateBanner').hidden) showMessage('Keine neue Version verfügbar.');
  } catch {
    if (manual) showMessage('Updateprüfung fehlgeschlagen. Prüfe deine Internetverbindung.');
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(worker => {
    registration = worker;
    const watch = () => registration.installing?.addEventListener('statechange', offerUpdate);
    registration.addEventListener('updatefound', watch);
    watch();
    offerUpdate();
    checkUpdate();
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) location.reload();
    else offerUpdate();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkUpdate();
  });
  window.addEventListener('online', () => checkUpdate());
  setInterval(() => { if (document.visibilityState === 'visible') checkUpdate(); }, 300000);
}
$('checkUpdate').addEventListener('click', () => checkUpdate(true));
$('applyUpdate').addEventListener('click', () => {
  if (!registration?.waiting || !save()) return;
  applying = true;
  $('applyUpdate').disabled = true;
  registration.waiting.postMessage('activate-update');
});
