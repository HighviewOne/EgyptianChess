let game;

function init() {
  game = new GameState();
  render();
}

// ─── Rendering ─────────────────────────────────────────────────────────────

function render() {
  renderBoard();
  updateStatus();
  updateCaptured();
  updateAnkhBtns();
  updateMoveLog();
}

function renderBoard() {
  const el = document.getElementById('board');
  el.innerHTML = '';

  const kingInCheck = (game.status === 'check' || game.status === 'checkmate')
    ? findKing(game.currentTurn, game.board) : -1;

  const legalTargets = new Set(game.legalMoves.map(m => m.to));

  for (let i = 0; i < 64; i++) {
    const { row, col } = idxToRC(i);
    const sq = document.createElement('div');
    sq.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
    if (PYRAMID_SQUARES.has(i)) sq.classList.add('pyramid');
    if (i === game.selectedIdx) sq.classList.add('selected');
    if (i === kingInCheck) sq.classList.add('in-check');
    if (legalTargets.has(i)) sq.classList.add(game.board[i] ? 'can-capture' : 'legal-move');

    if (game.ankhMode) {
      const validRows = game.currentTurn === COLORS.WHITE ? [6, 7] : [0, 1];
      if (validRows.includes(row) && !game.board[i]) sq.classList.add('ankh-target');
    }

    const piece = game.board[i];
    if (piece) {
      const pd = document.createElement('div');
      pd.className = `piece ${piece.color}`;
      pd.innerHTML = `<span class="psym">${PIECE_SYMBOLS[piece.color][piece.type]}</span>`
                   + `<span class="pname">${PIECE_NAMES[piece.type].slice(0,3).toUpperCase()}</span>`;
      sq.appendChild(pd);
    }

    sq.addEventListener('click', () => handleClick(i));
    el.appendChild(sq);
  }
}

// ─── Event Handling ─────────────────────────────────────────────────────────

function handleClick(idx) {
  if (game.pendingPromotion) return;
  const result = game.clickSquare(idx);
  if (result.action === 'promotion') showPromoDialog();
  render();
}

function showPromoDialog() {
  const dialog = document.getElementById('promo-dialog');
  const cont = document.getElementById('promo-pieces');
  cont.innerHTML = '';
  const color = game.pendingPromotion.color;
  for (const type of [PIECES.VIZIER, PIECES.CHARIOT, PIECES.PRIEST, PIECES.SPHINX]) {
    const btn = document.createElement('button');
    btn.className = 'promo-btn';
    btn.innerHTML = `<span class="psym">${PIECE_SYMBOLS[color][type]}</span><span>${PIECE_NAMES[type]}</span>`;
    btn.onclick = () => {
      game.promotePiece(type);
      dialog.classList.add('hidden');
      render();
    };
    cont.appendChild(btn);
  }
  dialog.classList.remove('hidden');
}

// ─── UI Updates ─────────────────────────────────────────────────────────────

function updateStatus() {
  const el = document.getElementById('status-text');
  const label = { white: 'Lower Egypt ☀', black: 'Upper Egypt ☽' };

  if (game.ankhMode) {
    const p = game._getAnkhPiece();
    const name = p ? PIECE_NAMES[p.piece.type] : 'piece';
    el.textContent = `☥ ANKH — Place your ${name} on a home square (Esc to cancel)`;
    el.className = 'ankh';
    return;
  }

  switch (game.status) {
    case 'playing':
      el.textContent = `${cap(game.currentTurn)} to move — ${label[game.currentTurn]}`;
      el.className = game.currentTurn;
      break;
    case 'check':
      el.textContent = `⚔ CHECK! ${cap(game.currentTurn)} (${label[game.currentTurn]}) must escape!`;
      el.className = 'check';
      break;
    case 'checkmate':
      el.textContent = `👑 CHECKMATE! ${cap(game.winner)} wins! Glory to the Pharaoh!`;
      el.className = 'over';
      break;
    case 'stalemate':
      el.textContent = `⚖ STALEMATE — The gods declare a draw!`;
      el.className = 'over';
      break;
  }
}

function updateCaptured() {
  // Each panel shows pieces that PLAYER HAS LOST (available for ankh resurrection)
  // capturedBy[opp] = pieces captured by opponent = pieces we lost
  for (const color of ['white', 'black']) {
    const el = document.getElementById(`${color}-captured`);
    el.innerHTML = '';
    const opp = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const lost = [...game.capturedBy[opp]].sort((a, b) => PIECE_VALUES[b.type] - PIECE_VALUES[a.type]);
    for (const p of lost) {
      const sp = document.createElement('span');
      sp.className = 'cap-piece';
      sp.title = PIECE_NAMES[p.type] + ' (lost)';
      sp.textContent = PIECE_SYMBOLS[p.color][p.type];
      el.appendChild(sp);
    }
  }
}

function updateAnkhBtns() {
  for (const color of ['white', 'black']) {
    const btn = document.getElementById(`${color}-ankh`);
    const isMyTurn = game.currentTurn === color;
    const opp = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    // Can resurrect if we have lost pieces (in opponent's capturedBy list)
    const hasLostPiece = game.capturedBy[opp].some(p => p.type !== PIECES.PHARAOH);
    const canUse = !game.ankhUsed[color]
      && isMyTurn
      && hasLostPiece
      && !game.pendingPromotion
      && game.status !== 'checkmate'
      && game.status !== 'stalemate';

    btn.disabled = !canUse;
    if (game.ankhUsed[color]) {
      btn.textContent = '☥ Ankh (used)';
      btn.classList.add('used');
      btn.classList.remove('active');
    } else {
      btn.textContent = '☥ Use Ankh';
      btn.classList.remove('used');
      btn.classList.toggle('active', game.ankhMode && isMyTurn);
    }
  }
}

function updateMoveLog() {
  const log = document.getElementById('move-log');
  log.innerHTML = '';
  for (let i = 0; i < game.history.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'mrow';
    const num = document.createElement('span');
    num.className = 'mnum';
    num.textContent = `${Math.floor(i / 2) + 1}.`;
    const w = document.createElement('span');
    w.className = 'mw';
    w.textContent = game.history[i].notation;
    row.appendChild(num);
    row.appendChild(w);
    if (game.history[i + 1]) {
      const b = document.createElement('span');
      b.className = 'mb';
      b.textContent = game.history[i + 1].notation;
      row.appendChild(b);
    }
    log.appendChild(row);
  }
  log.scrollTop = log.scrollHeight;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── Global Controls ─────────────────────────────────────────────────────────

document.getElementById('white-ankh').addEventListener('click', () => {
  if (game.currentTurn !== COLORS.WHITE) return;
  game.activateAnkh();
  render();
});
document.getElementById('black-ankh').addEventListener('click', () => {
  if (game.currentTurn !== COLORS.BLACK) return;
  game.activateAnkh();
  render();
});
document.getElementById('new-game-btn').addEventListener('click', () => {
  document.getElementById('promo-dialog').classList.add('hidden');
  game.reset();
  render();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && game.ankhMode) {
    game.cancelAnkh();
    render();
  }
});

init();
