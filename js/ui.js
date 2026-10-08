const E = window.PharaohEngine;

// Decorative hieroglyphs carved into squares
const SQ_GLYPHS = ['𓂀','𓋹','𓆗','𓊽','𓃬','𓀎','𓁢','𓇋','𓎛','𓍯','𓏛','𓂓','𓃀','𓆣','𓄿','𓀀'];
const REALM = { white: 'Lower Egypt', black: 'Upper Egypt' };

let game;
let flipped  = false;   // Black at the bottom
let focusIdx = E.rcToIdx(6, 4);   // board square that holds the keyboard tab stop (e2)
let ankhHint = null;    // temporary status message after an invalid Ankh placement
let cancelThink = null; // stops the computer's search in progress

// Browser storage can be unavailable (private mode, blocked site data)
const store = {
  get(k)    { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
};

// ── Audio ────────────────────────────────────────────────────────────────────

let muted = store.get('pharaoh-muted') === '1';

// ── Opponent ─────────────────────────────────────────────────────────────────

let opponentMode = store.get('pharaoh-opponent') || 'human';   // human | easy | medium | hard
let humanSide = store.get('pharaoh-side') === 'black' ? 'black' : 'white';
flipped = humanSide === 'black';

const computerColor  = () => opponentMode === 'human' ? null : (humanSide === 'white' ? 'black' : 'white');
const isComputerTurn = () => game.currentTurn === computerColor();

function stopThinking() {
  if (cancelThink) cancelThink();
  cancelThink = null;
}

function maybeComputerMove() {
  if (cancelThink || !isComputerTurn() || game.isOver() || game.pendingPromotion) return;
  cancelThink = window.PharaohAI.thinkInBackground(game, opponentMode, turn => {
    cancelThink = null;
    if (turn) playComputerTurn(turn);
    else render();
  });
  updateStatus();
}

function playComputerTurn(t) {
  if (t.kind === 'ankh') {
    game.activateAnkh();
    handleClick(t.to);
  } else {
    game.clickSquare(t.from);
    handleClick(t.move.to, t.promo);
  }
}
let audioCtx = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function tone(freq, type, dur, delay = 0, vol = 0.14) {
  if (muted) return;
  try {
    const ctx = ac();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + dur);
  } catch (_) {}
}
const SFX = {
  select:  () => tone(680, 'sine', 0.05),
  move:    () => tone(440, 'triangle', 0.1),
  capture: () => { tone(220, 'sawtooth', 0.08); tone(160, 'sawtooth', 0.08, 0.06); },
  check:   () => tone(150, 'square', 0.4, 0, 0.12),
  invalid: () => tone(110, 'square', 0.12, 0, 0.08),
  ankh:    () => { tone(262, 'triangle', 0.25); tone(330, 'triangle', 0.25, 0.25); tone(392, 'triangle', 0.25, 0.5); },
  win:     () => { tone(262, 'triangle', 0.3); tone(330, 'triangle', 0.3, 0.3); tone(392, 'triangle', 0.3, 0.6); tone(524, 'triangle', 0.5, 0.9); }
};

// ── FX ───────────────────────────────────────────────────────────────────────

function squareEl(idx) {
  return document.querySelector(`#board .square[data-idx="${idx}"]`);
}

function spawnDust(squareEl, color) {
  const fxLayer = document.getElementById('fx-layer');
  const frameRect = fxLayer.parentElement.getBoundingClientRect();
  const sqRect = squareEl.getBoundingClientRect();
  const cx = sqRect.left - frameRect.left + sqRect.width / 2;
  const cy = sqRect.top  - frameRect.top  + sqRect.height / 2;
  const dustColor = color === 'white' ? '#f5d574' : '#8a6432';

  for (let i = 0; i < 12; i++) {
    const d = document.createElement('div');
    d.className = 'dust';
    d.style.cssText = `left:${cx}px; top:${cy}px; background:${dustColor};`;
    fxLayer.appendChild(d);
    const angle = (i / 12) * Math.PI * 2;
    const dist = 24 + Math.random() * 28;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    d.animate(
      [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
       { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`, opacity: 0 }],
      { duration: 650, easing: 'ease-out' }
    ).onfinish = () => d.remove();
  }
}

function showAnkhBurst() {
  const burst = document.getElementById('ankh-burst');
  burst.innerHTML = '';
  burst.classList.remove('hidden');
  for (let i = 0; i < 10; i++) {
    const ray = document.createElement('div');
    ray.className = 'ray';
    ray.style.setProperty('--angle', `${i * 36}deg`);
    burst.appendChild(ray);
  }
  const sym = document.createElement('div');
  sym.className = 'ankh-symbol';
  sym.textContent = '☥';
  burst.appendChild(sym);
  setTimeout(() => { burst.classList.add('hidden'); burst.innerHTML = ''; }, 1300);
}

// ── Rendering ────────────────────────────────────────────────────────────────

function render() {
  renderBoard();
  updateStatus();
  updateCaptured();
  updateAnkhBtns();
  updateMoveLog();
  updatePanelActive();
  updateControls();
  saveGame();
  maybeComputerMove();
}

// ── Save / restore ───────────────────────────────────────────────────────────

const SAVE_KEY = 'pharaoh-game';

function saveGame() {
  store.set(SAVE_KEY, JSON.stringify({ version: 1, moves: game.moveList() }));
}

function loadGame() {
  try {
    const saved = JSON.parse(store.get(SAVE_KEY));
    if (saved?.version === 1) return GameState.fromMoveList(saved.moves);
  } catch (_) {}
  return null;
}

// Board index shown at display position d (0 = top-left)
const displayToIdx = (d) => flipped ? 63 - d : d;

function squareLabel(i, piece, isLegal) {
  let label = E.squareName(i) + (E.PYRAMID_SQUARES.has(i) ? ' (Pyramid)' : '');
  if (piece) label += `, ${cap(piece.color)} ${E.PIECE_NAMES[piece.type]}`;
  if (i === game.selectedIdx) label += ', selected';
  if (isLegal) label += piece ? ', capture' : ', legal move';
  return label;
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  const hadFocus = boardEl.contains(document.activeElement);
  boardEl.innerHTML = '';
  document.querySelector('.board-with-labels').classList.toggle('flipped', flipped);

  const kingCheck = (game.status === 'check' || game.status === 'checkmate')
    ? E.findKing(game.currentTurn, game.board) : -1;
  const legalSet = new Set(game.legalMoves.map(m => m.to));
  const ankhRows = game.currentTurn === E.COLORS.WHITE ? [6, 7] : [0, 1];

  for (let d = 0; d < 64; d++) {
    const i = displayToIdx(d);
    const { row, col } = E.idxToRC(i);
    const sq = document.createElement('button');
    sq.type = 'button';
    sq.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
    sq.dataset.idx = i;
    sq.dataset.glyph = SQ_GLYPHS[i % SQ_GLYPHS.length];
    sq.tabIndex = i === focusIdx ? 0 : -1;

    const piece = game.board[i];
    sq.setAttribute('aria-label', squareLabel(i, piece, legalSet.has(i)));
    if (E.PYRAMID_SQUARES.has(i)) { sq.classList.add('pyramid'); if (piece) sq.classList.add('occupied'); }
    if (i === game.selectedIdx) sq.classList.add('selected');
    if (i === kingCheck)        sq.classList.add('in-check');
    if (i === game.lastFrom)    sq.classList.add('last-move-from');
    if (i === game.lastTo)      sq.classList.add('last-move-to');

    if (legalSet.has(i)) {
      const indicator = document.createElement('div');
      indicator.className = piece ? 'move-cap' : 'move-dot';
      sq.appendChild(indicator);
    }

    if (game.ankhMode && ankhRows.includes(row) && !piece) sq.classList.add('ankh-target');

    if (piece) {
      const pd = document.createElement('div');
      pd.className = `piece ${piece.color}`;
      pd.innerHTML = window.PIECE_SVGS[piece.type];
      sq.appendChild(pd);
    }

    boardEl.appendChild(sq);
  }
  if (hadFocus) squareEl(focusIdx)?.focus();
}

function updatePanelActive() {
  for (const color of [E.COLORS.WHITE, E.COLORS.BLACK]) {
    document.getElementById(`${color}-panel`).classList.toggle('active', game.currentTurn === color && !game.isOver());
  }
}

function updateControls() {
  document.getElementById('undo-btn').disabled = !game.canUndo();
  document.getElementById('opponent-select').value = opponentMode;
  const sideSel = document.getElementById('side-select');
  sideSel.value = humanSide;
  sideSel.disabled = opponentMode === 'human';
  for (const color of ['white', 'black']) {
    document.getElementById(`${color}-panel`).classList.toggle('computer', computerColor() === color);
  }
  const muteBtn = document.getElementById('mute-btn');
  muteBtn.textContent = muted ? '🔇 Sound Off' : '🔊 Sound On';
  muteBtn.setAttribute('aria-pressed', String(muted));
}

// ── Event handling ────────────────────────────────────────────────────────────

const ANKH_HINTS = {
  not_home: 'must go on your back two ranks',
  occupied: 'that square is taken',
  check:    'that would leave your Pharaoh in check'
};

function handleClick(idx, promo = null) {
  if (game.pendingPromotion) return;

  if (game.ankhMode) {
    const result = game.clickSquare(idx);
    if (result.action === 'ankh_placed') {
      ankhHint = null;
      SFX.ankh();
      showAnkhBurst();
      render();
      afterTurn();
    } else if (result.action === 'ankh_invalid') {
      ankhHint = ANKH_HINTS[result.reason];
      SFX.invalid();
      updateStatus();
      squareEl(idx)?.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
         { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
        { duration: 220 }
      );
    }
    return;
  }

  const result = game.clickSquare(idx);

  if (result.action === 'select') { SFX.select(); }
  else if (result.action === 'move' || result.action === 'promotion') {
    if (result.record?.captured) {
      SFX.capture();
      const sqEl = squareEl(result.record.to);
      if (sqEl) spawnDust(sqEl, result.record.color);
    } else {
      SFX.move();
    }
    if (result.action === 'promotion' && promo) game.promotePiece(promo);
    render();
    if (game.pendingPromotion) showPromoDialog();
    else afterTurn();
    return;
  }

  render();
}

// Sounds and dialogs once a turn has fully finished
function afterTurn() {
  if (game.status === 'check')     SFX.check();
  if (game.status === 'checkmate') triggerGameOver();
  if (game.status === 'stalemate') triggerStalemate();
  if (game.status === 'draw')      triggerDraw();
}

// Arrow keys move the tab stop around the board; Enter/Space activate natively
function handleBoardKey(e) {
  const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (!step) return;
  e.preventDefault();
  const dir = flipped ? -1 : 1;
  const { row, col } = E.idxToRC(focusIdx);
  const r = Math.min(7, Math.max(0, row + step[0] * dir));
  const c = Math.min(7, Math.max(0, col + step[1] * dir));
  squareEl(focusIdx).tabIndex = -1;
  focusIdx = E.rcToIdx(r, c);
  const next = squareEl(focusIdx);
  next.tabIndex = 0;
  next.focus();
}

function showPromoDialog() {
  const dialog = document.getElementById('promo-dialog');
  const cont   = document.getElementById('promo-pieces');
  cont.innerHTML = '';
  const color = game.pendingPromotion.color;
  for (const type of [E.PIECES.VIZIER, E.PIECES.CHARIOT, E.PIECES.PRIEST, E.PIECES.SPHINX]) {
    const btn = document.createElement('button');
    btn.className = 'promo-btn';
    const psvg = document.createElement('div');
    psvg.className = `piece ${color} promo-piece`;
    psvg.innerHTML = window.PIECE_SVGS[type];
    const lbl = document.createElement('span');
    lbl.textContent = E.PIECE_NAMES[type];
    btn.appendChild(psvg);
    btn.appendChild(lbl);
    btn.onclick = () => {
      game.promotePiece(type);
      SFX.move();
      dialog.classList.add('hidden');
      render();
      afterTurn();
    };
    cont.appendChild(btn);
  }
  dialog.classList.remove('hidden');
  cont.querySelector('button').focus();
}

function showOverDialog(crest, title, msg) {
  document.getElementById('over-crest').textContent = crest;
  document.getElementById('over-title').textContent = title;
  document.getElementById('over-msg').textContent   = msg;
  document.getElementById('over-dialog').classList.remove('hidden');
  document.getElementById('over-new-btn').focus();
}

function triggerGameOver() {
  const winner = game.winner;
  const title = !computerColor() ? `${cap(winner)} Triumphs!`
    : winner === computerColor() ? 'The Computer Triumphs' : 'You Triumph!';
  showOverDialog(winner === 'white' ? '𓋹' : '𓁢', title,
    `${REALM[winner]} claims the throne. All glory to the Pharaoh!`);
  SFX.win();
}

function triggerStalemate() {
  showOverDialog('⚖', 'Stalemate', 'The gods decree a sacred draw. Neither Egypt falls.');
}

function triggerDraw() {
  showOverDialog('⚖', 'Draw', `A draw by ${game.drawReason}. Neither Egypt falls.`);
}

function hideDialogs() {
  document.getElementById('promo-dialog').classList.add('hidden');
  document.getElementById('over-dialog').classList.add('hidden');
}

// ── Status & counters ─────────────────────────────────────────────────────────

function updateStatus() {
  const el = document.getElementById('status-text');

  if (game.ankhMode) {
    const p = game._getAnkhPiece();
    el.textContent = ankhHint
      ? `☥ Not there — ${ankhHint} (Esc to cancel)`
      : p
        ? `☥ Ankh — place your ${E.PIECE_NAMES[p.piece.type]} on a home square (Esc to cancel)`
        : '☥ Ankh active';
    el.className = 'ankh';
    return;
  }
  if (cancelThink) {
    el.textContent = `${game.status === 'check' ? '⚔ Check! ' : ''}𓂀 The computer is thinking…`;
    el.className = 'thinking';
    return;
  }
  switch (game.status) {
    case 'playing':
      el.textContent = `${cap(game.currentTurn)} to move — ${REALM[game.currentTurn]} ${game.currentTurn === 'white' ? '☀' : '☽'}`;
      el.className = '';
      break;
    case 'check':
      el.textContent = `⚔ Check! ${cap(game.currentTurn)} must escape!`;
      el.className = 'check';
      break;
    case 'checkmate':
      el.textContent = `${cap(game.winner)} triumphs — Checkmate!`;
      el.className = 'over';
      break;
    case 'stalemate':
      el.textContent = 'Stalemate — Sacred draw';
      el.className = 'over';
      break;
    case 'draw':
      el.textContent = `Draw — ${cap(game.drawReason)}`;
      el.className = 'over';
      break;
  }
}

function updateCaptured() {
  // Each panel shows pieces that PLAYER has LOST (in opponent's capturedBy list)
  for (const color of ['white', 'black']) {
    const el  = document.getElementById(`${color}-captured`);
    const opp = color === E.COLORS.WHITE ? E.COLORS.BLACK : E.COLORS.WHITE;
    el.innerHTML = '';
    const lost = [...game.capturedBy[opp]].sort((a, b) => E.PIECE_VALUES[b.type] - E.PIECE_VALUES[a.type]);
    for (const p of lost) {
      const sp = document.createElement('div');
      sp.className = `cap-piece ${p.color}`;
      sp.title = E.PIECE_NAMES[p.type];
      sp.setAttribute('role', 'img');
      sp.setAttribute('aria-label', E.PIECE_NAMES[p.type]);
      sp.innerHTML = window.PIECE_SVGS[p.type];
      el.appendChild(sp);
    }
  }
}

function updateAnkhBtns() {
  for (const color of ['white', 'black']) {
    const btn = document.getElementById(`${color}-ankh`);
    const lbl = document.getElementById(`${color}-ankh-label`);
    const isMyTurn = game.currentTurn === color;
    const opp = color === E.COLORS.WHITE ? E.COLORS.BLACK : E.COLORS.WHITE;
    const hasLost = game.capturedBy[opp].some(p => p.type !== E.PIECES.PHARAOH);
    const canUse  = !game.ankhUsed[color] && isMyTurn && hasLost && color !== computerColor()
                    && !game.pendingPromotion && !game.isOver();

    btn.disabled = !canUse;
    if (game.ankhUsed[color]) {
      btn.textContent = 'Ankh Used';
      btn.classList.add('used'); btn.classList.remove('active');
      lbl.textContent = 'resurrection spent';
    } else {
      const active = game.ankhMode && isMyTurn;
      btn.textContent = active ? 'Cancel Ankh' : 'Ankh Resurrection';
      btn.classList.remove('used');
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      lbl.textContent = '1 resurrection remaining';
    }
  }
}

function updateMoveLog() {
  const log = document.getElementById('move-log');
  log.innerHTML = '';
  for (let i = 0; i < game.history.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'mrow';
    const num = document.createElement('span'); num.className = 'mnum'; num.textContent = `${Math.floor(i/2)+1}.`;
    const w   = document.createElement('span'); w.className = 'mw';   w.textContent   = game.history[i].notation;
    row.appendChild(num); row.appendChild(w);
    if (game.history[i+1]) {
      const b = document.createElement('span'); b.className = 'mb'; b.textContent = game.history[i+1].notation;
      row.appendChild(b);
    }
    log.appendChild(row);
  }
  log.scrollTop = log.scrollHeight;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Controls ─────────────────────────────────────────────────────────────────

function resetGame() {
  stopThinking();
  hideDialogs();
  game.reset();
  ankhHint = null;
  render();
}

function undoMove() {
  stopThinking();
  if (!game.undo()) return;
  // Against the computer, take back its reply too so it is your turn again
  if (isComputerTurn() && game.canUndo()) game.undo();
  hideDialogs();
  ankhHint = null;
  render();
}

function toggleAnkh(color) {
  if (game.currentTurn !== color || color === computerColor()) return;
  ankhHint = null;
  // Clicking the active Ankh button again cancels placement
  if (game.ankhMode) game.cancelAnkh();
  else if (!game.activateAnkh()) return;
  render();
}

const boardEl = document.getElementById('board');
boardEl.addEventListener('click', e => {
  const sq = e.target.closest('.square');
  if (!sq || isComputerTurn()) return;
  focusIdx = Number(sq.dataset.idx);
  handleClick(focusIdx);
});
boardEl.addEventListener('keydown', handleBoardKey);

for (const color of [E.COLORS.WHITE, E.COLORS.BLACK]) {
  document.getElementById(`${color}-ankh`).addEventListener('click', () => toggleAnkh(color));
}
document.getElementById('new-game-btn').addEventListener('click', resetGame);
document.getElementById('over-new-btn').addEventListener('click', resetGame);
document.getElementById('undo-btn').addEventListener('click', undoMove);
document.getElementById('over-undo-btn').addEventListener('click', undoMove);
document.getElementById('promo-undo-btn').addEventListener('click', undoMove);
document.getElementById('over-view-btn').addEventListener('click', hideDialogs);
document.getElementById('flip-btn').addEventListener('click', () => { flipped = !flipped; render(); });
document.getElementById('opponent-select').addEventListener('change', e => {
  stopThinking();
  opponentMode = e.target.value;
  store.set('pharaoh-opponent', opponentMode);
  if (game.ankhMode && isComputerTurn()) game.cancelAnkh();
  render();
});
document.getElementById('side-select').addEventListener('change', e => {
  stopThinking();
  humanSide = e.target.value;
  store.set('pharaoh-side', humanSide);
  flipped = humanSide === 'black';
  if (game.ankhMode && isComputerTurn()) game.cancelAnkh();
  render();
});
document.getElementById('mute-btn').addEventListener('click', () => {
  muted = !muted;
  store.set('pharaoh-muted', muted ? '1' : '0');
  updateControls();
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoMove(); return; }
  if (e.key !== 'Escape') return;
  if (game.ankhMode) { toggleAnkh(game.currentTurn); return; }
  if (!document.getElementById('over-dialog').classList.contains('hidden')) hideDialogs();
});

// ── Init ──────────────────────────────────────────────────────────────────────

game = loadGame() || new GameState();
render();
if (game.pendingPromotion) showPromoDialog();
