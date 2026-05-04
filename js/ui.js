const E = window.PharaohEngine;

// Decorative hieroglyphs carved into squares
const SQ_GLYPHS = ['𓂀','𓋹','𓆗','𓊽','𓃬','𓀎','𓁢','𓇋','𓎛','𓍯','𓏛','𓂓','𓃀','𓆣','𓄿','𓀀'];

let game;

// ── Audio ────────────────────────────────────────────────────────────────────

let audioCtx = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function tone(freq, type, dur, delay = 0, vol = 0.14) {
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
  ankh:    () => { tone(262, 'triangle', 0.25); tone(330, 'triangle', 0.25, 0.25); tone(392, 'triangle', 0.25, 0.5); },
  win:     () => { tone(262, 'triangle', 0.3); tone(330, 'triangle', 0.3, 0.3); tone(392, 'triangle', 0.3, 0.6); tone(524, 'triangle', 0.5, 0.9); }
};

// ── FX ───────────────────────────────────────────────────────────────────────

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
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';

  const kingCheck = (game.status === 'check' || game.status === 'checkmate')
    ? E.findKing(game.currentTurn, game.board) : -1;
  const legalSet = new Set(game.legalMoves.map(m => m.to));

  for (let i = 0; i < 64; i++) {
    const { row, col } = E.idxToRC(i);
    const sq = document.createElement('div');
    sq.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
    sq.dataset.glyph = SQ_GLYPHS[i % SQ_GLYPHS.length];

    const piece = game.board[i];
    const isPyramid = E.PYRAMID_SQUARES.has(i);
    if (isPyramid) { sq.classList.add('pyramid'); if (piece) sq.classList.add('occupied'); }
    if (i === game.selectedIdx) sq.classList.add('selected');
    if (i === kingCheck)        sq.classList.add('in-check');
    if (i === game.lastFrom)    sq.classList.add('last-move-from');
    if (i === game.lastTo)      sq.classList.add('last-move-to');

    if (legalSet.has(i)) {
      const indicator = document.createElement('div');
      indicator.className = piece ? 'move-cap' : 'move-dot';
      sq.appendChild(indicator);
    }

    if (game.ankhMode) {
      const validRows = game.currentTurn === E.COLORS.WHITE ? [6, 7] : [0, 1];
      if (validRows.includes(row) && !piece) sq.classList.add('ankh-target');
    }

    if (piece) {
      const pd = document.createElement('div');
      pd.className = `piece ${piece.color}`;
      pd.innerHTML = window.PIECE_SVGS[piece.type];
      sq.appendChild(pd);
    }

    sq.addEventListener('click', () => handleClick(i));
    boardEl.appendChild(sq);
  }
}

function updatePanelActive() {
  document.getElementById('white-panel').classList.toggle('active', game.currentTurn === E.COLORS.WHITE && game.status !== 'checkmate' && game.status !== 'stalemate');
  document.getElementById('black-panel').classList.toggle('active', game.currentTurn === E.COLORS.BLACK && game.status !== 'checkmate' && game.status !== 'stalemate');
}

// ── Event handling ────────────────────────────────────────────────────────────

function handleClick(idx) {
  if (game.pendingPromotion) return;

  if (game.ankhMode) {
    const result = game.clickSquare(idx);
    if (result.action === 'ankh_placed') {
      SFX.ankh();
      showAnkhBurst();
      render();
      if (game.status === 'checkmate') triggerGameOver();
      else if (game.status === 'stalemate') triggerStalemate();
    }
    return;
  }

  const prevSelected = game.selectedIdx;
  const result = game.clickSquare(idx);

  if (result.action === 'select') { SFX.select(); }
  else if (result.action === 'deselect') { /* silent */ }
  else if (result.action === 'move' || result.action === 'promotion') {
    if (result.record?.captured) {
      SFX.capture();
      const sqEl = document.getElementById('board').children[result.record.to];
      if (sqEl) spawnDust(sqEl, result.record.color);
    } else {
      SFX.move();
    }
    if (result.action === 'promotion') { render(); showPromoDialog(); return; }
    if (game.status === 'check')      SFX.check();
    if (game.status === 'checkmate')  { render(); triggerGameOver(); return; }
    if (game.status === 'stalemate')  { render(); triggerStalemate(); return; }
  }

  render();
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
      if (game.status === 'check')     SFX.check();
      if (game.status === 'checkmate') triggerGameOver();
      if (game.status === 'stalemate') triggerStalemate();
    };
    cont.appendChild(btn);
  }
  dialog.classList.remove('hidden');
}

function triggerGameOver() {
  const winner = game.winner;
  const realm  = { white: 'Lower Egypt', black: 'Upper Egypt' };
  document.getElementById('over-crest').textContent = winner === 'white' ? '𓋹' : '𓁢';
  document.getElementById('over-title').textContent  = `${cap(winner)} Triumphs!`;
  document.getElementById('over-msg').textContent    = `${realm[winner]} claims the throne. All glory to the Pharaoh!`;
  document.getElementById('over-dialog').classList.remove('hidden');
  SFX.win();
}

function triggerStalemate() {
  document.getElementById('over-crest').textContent = '⚖';
  document.getElementById('over-title').textContent  = 'Stalemate';
  document.getElementById('over-msg').textContent    = 'The gods decree a sacred draw. Neither Egypt falls.';
  document.getElementById('over-dialog').classList.remove('hidden');
}

// ── Status & counters ─────────────────────────────────────────────────────────

function updateStatus() {
  const el    = document.getElementById('status-text');
  const realm = { white: 'Lower Egypt ☀', black: 'Upper Egypt ☽' };

  if (game.ankhMode) {
    const p = game._getAnkhPiece();
    el.textContent = p
      ? `☥ Ankh — place your ${E.PIECE_NAMES[p.piece.type]} on a home square (Esc to cancel)`
      : '☥ Ankh active';
    el.className = 'ankh';
    return;
  }
  switch (game.status) {
    case 'playing':
      el.textContent = `${cap(game.currentTurn)} to move — ${realm[game.currentTurn]}`;
      el.className = '';
      break;
    case 'check':
      el.textContent = `⚔ Check! ${cap(game.currentTurn)} must escape!`;
      el.className = 'check';
      break;
    case 'checkmate':
    case 'stalemate':
      el.textContent = game.status === 'checkmate'
        ? `${cap(game.winner)} triumphs — Checkmate!`
        : 'Stalemate — Sacred draw';
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
    const canUse  = !game.ankhUsed[color] && isMyTurn && hasLost
                    && !game.pendingPromotion
                    && game.status !== 'checkmate' && game.status !== 'stalemate';

    btn.disabled = !canUse;
    if (game.ankhUsed[color]) {
      btn.textContent = 'Ankh Used';
      btn.classList.add('used'); btn.classList.remove('active');
      lbl.textContent = 'resurrection spent';
    } else {
      btn.textContent = 'Ankh Resurrection';
      btn.classList.remove('used');
      btn.classList.toggle('active', game.ankhMode && isMyTurn);
      lbl.textContent = '1 resurrection remaining';
    }
    // Re-add the ::before via the CSS — just fix the textContent prefix
    // (the ::before pseudo-element handles the ☥ glyph)
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
  document.getElementById('promo-dialog').classList.add('hidden');
  document.getElementById('over-dialog').classList.add('hidden');
  game.reset();
  render();
}

document.getElementById('white-ankh').addEventListener('click', () => {
  if (game.currentTurn !== E.COLORS.WHITE) return;
  if (game.activateAnkh()) render();
});
document.getElementById('black-ankh').addEventListener('click', () => {
  if (game.currentTurn !== E.COLORS.BLACK) return;
  if (game.activateAnkh()) render();
});
document.getElementById('new-game-btn').addEventListener('click', resetGame);
document.getElementById('over-new-btn').addEventListener('click', resetGame);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && game.ankhMode) { game.cancelAnkh(); render(); }
});

// ── Init ──────────────────────────────────────────────────────────────────────

game = new GameState();
render();
