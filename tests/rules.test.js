// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  const src = ['engine.js', 'game.js', 'ai.js']
    .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'))
    .join('\n');
  vm.runInContext(src + '\nthis.GameState = GameState;', ctx);
  return { E: ctx.window.PharaohEngine, AI: ctx.window.PharaohAI, GameState: ctx.GameState };
}

const { E, AI, GameState } = load();
const sq = (s) => E.rcToIdx(8 - Number(s[1]), 'abcdefgh'.indexOf(s[0]));

function play(game, ...moves) {
  let result;
  for (const m of moves) {
    const [from, to] = m.split('-');
    game.clickSquare(sq(from));
    result = game.clickSquare(sq(to));
  }
  return result;
}

function emptyGame(pieces, turn = 'white') {
  const g = new GameState();
  g.board = new Array(64).fill(null);
  for (const [s, type, color] of pieces) g.board[sq(s)] = { type, color };
  g.currentTurn = turn;
  return g;
}

test('initial position has 20 legal moves for White', () => {
  const g = new GameState();
  let n = 0;
  for (let i = 0; i < 64; i++) {
    if (g.board[i]?.color === 'white') n += E.getLegalMoves(i, g.board, null).length;
  }
  // 16 soldier moves + 4 sphinx knight jumps (diagonal slides start blocked)
  assert.strictEqual(n, 20);
});

test('Sphinx slides 1–2 squares diagonally but cannot jump', () => {
  const b = new Array(64).fill(null);
  b[sq('d4')] = { type: 'sphinx', color: 'white' };
  b[sq('e5')] = { type: 'soldier', color: 'white' };
  const to = E.getRawMoves(sq('d4'), b, null).map(m => E.squareName(m.to));
  assert.ok(to.includes('c3') && to.includes('b2'));
  assert.ok(!to.includes('e5') && !to.includes('f6'));
  assert.ok(to.includes('e6') && to.includes('f5')); // knight jumps still work
});

test('en passant is recorded as a capture', () => {
  const g = new GameState();
  const r = play(g, 'e2-e4', 'a7-a6', 'e4-e5', 'd7-d5', 'e5-d6');
  assert.strictEqual(r.record.captured, 'soldier');
  assert.strictEqual(r.record.notation, 'e5xd6');
  assert.strictEqual(g.board[sq('d5')], null);
  assert.strictEqual(g.capturedBy.white.length, 1);
});

test('notation symbols are unique per piece', () => {
  const syms = Object.values(E.PIECE_SYMBOLS).filter(Boolean);
  assert.strictEqual(new Set(syms).size, syms.length);
});

test('fool\'s "mate" is only check here: the Sphinx can block on f2', () => {
  const g = new GameState();
  play(g, 'f2-f3', 'e7-e5', 'g2-g4', 'd8-h4');
  assert.strictEqual(g.status, 'check');
  assert.strictEqual(g.history.at(-1).notation, 'Vd8-h4+');
  assert.ok(E.getLegalMoves(sq('g1'), g.board, g.epTarget).some(m => m.to === sq('f2')));
});

test('back-rank checkmate is detected and marked with #', () => {
  const g = emptyGame([
    ['h1', 'pharaoh', 'white'], ['g2', 'soldier', 'white'], ['h2', 'soldier', 'white'],
    ['b8', 'chariot', 'black'], ['a8', 'pharaoh', 'black'],
  ], 'black');
  play(g, 'b8-b1');
  assert.strictEqual(g.status, 'checkmate');
  assert.strictEqual(g.winner, 'black');
  assert.strictEqual(g.history.at(-1).notation, 'Cb8-b1#');
});

test('an available Ankh placement prevents a false checkmate', () => {
  const pieces = [
    ['h1', 'pharaoh', 'white'], ['g2', 'soldier', 'white'], ['h2', 'soldier', 'white'],
    ['a1', 'chariot', 'black'], ['a8', 'pharaoh', 'black'],
  ];
  const g = emptyGame(pieces);
  g.capturedBy.black.push({ type: 'priest', color: 'white' });
  g._updateStatus();
  assert.strictEqual(g.status, 'check');
  assert.ok(g.activateAnkh());
  assert.strictEqual(g.clickSquare(sq('f1')).action, 'ankh_placed');
  assert.strictEqual(E.isInCheck('white', g.board), false);

  const spent = emptyGame(pieces);
  spent.capturedBy.black.push({ type: 'priest', color: 'white' });
  spent.ankhUsed.white = true;
  spent._updateStatus();
  assert.strictEqual(spent.status, 'checkmate');
});

test('Ankh placement must be on own home ranks and resolve check', () => {
  const g = emptyGame([
    ['h1', 'pharaoh', 'white'], ['g2', 'soldier', 'white'], ['h2', 'soldier', 'white'],
    ['a1', 'chariot', 'black'], ['a8', 'pharaoh', 'black'],
  ]);
  g.capturedBy.black.push({ type: 'priest', color: 'white' });
  g._updateStatus();
  g.activateAnkh();
  assert.strictEqual(g.clickSquare(sq('d4')).action, 'ankh_invalid'); // not a home rank
  assert.strictEqual(g.clickSquare(sq('a2')).action, 'ankh_invalid'); // leaves check
  assert.strictEqual(g.ankhUsed.white, false);
});

test('promotion appends the chosen piece to the notation', () => {
  const g = emptyGame([
    ['a7', 'soldier', 'white'], ['e1', 'pharaoh', 'white'], ['h5', 'pharaoh', 'black'],
  ]);
  assert.strictEqual(play(g, 'a7-a8').action, 'promotion');
  g.promotePiece('chariot');
  assert.strictEqual(g.board[sq('a8')].type, 'chariot');
  assert.strictEqual(g.history.at(-1).notation, 'a7-a8=C');
  assert.strictEqual(g.currentTurn, 'black');
});

test('threefold repetition ends the game in a draw', () => {
  const g = new GameState();
  const shuffle = ['g1-f3', 'g8-f6', 'f3-g1', 'f6-g8'];
  play(g, ...shuffle);
  assert.strictEqual(g.status, 'playing');
  play(g, ...shuffle);
  assert.strictEqual(g.status, 'draw');
  assert.strictEqual(g.drawReason, 'threefold repetition');
  assert.strictEqual(g.clickSquare(sq('e2')).action, 'gameover');
});

test('fifty-move rule: 100 quiet plies draw, a Soldier move resets the count', () => {
  const g = new GameState();
  g.halfmoveClock = 98;
  play(g, 'e2-e4');
  assert.strictEqual(g.halfmoveClock, 0);
  g.halfmoveClock = 99;
  play(g, 'g8-f6');
  assert.strictEqual(g.status, 'draw');
  assert.strictEqual(g.drawReason, 'fifty-move rule');
});

test('insufficient material draws only when no Ankh can bring pieces back', () => {
  const pieces = [['e1', 'pharaoh', 'white'], ['e8', 'pharaoh', 'black'], ['c1', 'priest', 'white']];
  const g = emptyGame(pieces);
  g._updateStatus();
  assert.strictEqual(g.status, 'draw');
  assert.strictEqual(g.drawReason, 'insufficient material');

  const withAnkh = emptyGame(pieces);
  withAnkh.capturedBy.white.push({ type: 'chariot', color: 'black' });
  withAnkh._updateStatus();
  assert.strictEqual(withAnkh.status, 'playing');

  const sphinx = emptyGame([['e1', 'pharaoh', 'white'], ['e8', 'pharaoh', 'black'], ['b1', 'sphinx', 'white']]);
  sphinx._updateStatus();
  assert.strictEqual(sphinx.status, 'playing');
});

test('undo restores the previous position, including captures and Ankh use', () => {
  const g = new GameState();
  const start = JSON.stringify(g.board);
  play(g, 'e2-e4', 'd7-d5', 'e4-d5');
  assert.strictEqual(g.capturedBy.white.length, 1);
  assert.ok(g.undo());
  assert.strictEqual(g.capturedBy.white.length, 0);
  assert.strictEqual(g.board[sq('d5')].color, 'black');
  assert.strictEqual(g.currentTurn, 'white');
  play(g, 'e4-d5', 'd8-d5');
  g.activateAnkh();
  assert.strictEqual(g.clickSquare(sq('e2')).action, 'ankh_placed');
  g.undo();
  assert.strictEqual(g.ankhUsed.white, false);
  assert.strictEqual(g.board[sq('e2')], null);
  while (g.undo());
  assert.strictEqual(JSON.stringify(g.board), start);
  assert.strictEqual(g.history.length, 0);
  assert.strictEqual(g.canUndo(), false);
});

test('undo during a pending promotion takes the Soldier move back', () => {
  const g = emptyGame([['a7', 'soldier', 'white'], ['e1', 'pharaoh', 'white'], ['h5', 'pharaoh', 'black']]);
  play(g, 'a7-a8');
  assert.ok(g.pendingPromotion);
  g.undo();
  assert.strictEqual(g.pendingPromotion, null);
  assert.strictEqual(g.board[sq('a7')].type, 'soldier');
  assert.strictEqual(g.history.length, 0);
});

test('invalid Ankh placements report why', () => {
  const g = new GameState();
  play(g, 'e2-e4', 'd7-d5', 'e4-d5', 'd8-d5');
  g.activateAnkh();
  assert.strictEqual(g.clickSquare(sq('e4')).reason, 'not_home');
  assert.strictEqual(g.clickSquare(sq('a2')).reason, 'occupied');
  const r = g.clickSquare(sq('e2'));
  assert.strictEqual(r.action, 'ankh_placed');
  assert.strictEqual(g.history.at(-1).notation, '☥e2');
});

test('fast attack detection matches move generation on random positions', () => {
  // The original definition: any enemy pseudo-move lands on the square
  const slow = (square, byColor, board) => board.some((p, i) =>
    p?.color === byColor && E.getRawMoves(i, board, null).some(m => m.to === square));
  const types = Object.values(E.PIECES);
  let seed = 12345;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let t = 0; t < 3000; t++) {
    const board = new Array(64).fill(null);
    const count = 2 + rand(20);
    for (let k = 0; k < count; k++) {
      board[rand(64)] = { type: types[rand(types.length)], color: rand(2) ? 'white' : 'black' };
    }
    for (let sqi = 0; sqi < 64; sqi++) {
      if (!board[sqi]) continue;
      const by = board[sqi].color === 'white' ? 'black' : 'white';
      assert.strictEqual(E.isSquareAttacked(sqi, by, board), slow(sqi, by, board),
        `square ${E.squareName(sqi)} on ${JSON.stringify(board)}`);
    }
  }
});

// ── Computer opponent ──────────────────────────────────────────────────────

const backRank = [
  ['h1', 'pharaoh', 'white'], ['g2', 'soldier', 'white'], ['h2', 'soldier', 'white'],
  ['b8', 'chariot', 'black'], ['a8', 'pharaoh', 'black'], ['a7', 'soldier', 'black'], ['c7', 'soldier', 'black'],
];

test('computer finds a back-rank mate in one', () => {
  const g = emptyGame(backRank, 'black');
  const t = AI.bestTurn(g, 2);
  assert.strictEqual(t.kind, 'move');
  assert.strictEqual(E.squareName(t.from) + E.squareName(t.move.to), 'b8b1');
});

test('computer takes a free Vizier', () => {
  const g = emptyGame([
    ['e1', 'pharaoh', 'white'], ['c3', 'sphinx', 'white'],
    ['e8', 'pharaoh', 'black'], ['d5', 'vizier', 'black'],
  ]);
  const t = AI.bestTurn(g, 2);
  assert.strictEqual(E.squareName(t.from) + E.squareName(t.move.to), 'c3d5');
});

test('computer resurrects with the Ankh when it is the only escape', () => {
  const g = emptyGame([
    ['h1', 'pharaoh', 'white'], ['g2', 'soldier', 'white'], ['h2', 'soldier', 'white'],
    ['a1', 'chariot', 'black'], ['a8', 'pharaoh', 'black'],
  ]);
  g.capturedBy.black.push({ type: 'priest', color: 'white' });
  g._updateStatus();
  const t = AI.bestTurn(g, 2);
  assert.strictEqual(t.kind, 'ankh');
  assert.ok(['b1', 'c1', 'd1', 'e1', 'f1', 'g1'].includes(E.squareName(t.to)));
});

test('computer search state applies turns like the real game', () => {
  const g = new GameState();
  play(g, 'e2-e4', 'a7-a6', 'e4-e5', 'd7-d5');
  const state = AI.fromGame(g);
  const ep = AI.generate(state).find(t => t.move?.special === 'enPassant');
  const next = AI.apply(state, ep);
  play(g, 'e5-d6');
  assert.strictEqual(JSON.stringify(next.board), JSON.stringify(g.board));
  assert.strictEqual(JSON.stringify(next.lost.black), '["soldier"]');
});

test('computer knows about repetition: a lost side takes the threefold draw', () => {
  // White is a Vizier up; Black can repeat the start position for the third time with h7-h8
  const g = emptyGame([
    ['e1', 'pharaoh', 'white'], ['d1', 'vizier', 'white'], ['a1', 'chariot', 'white'],
    ['e8', 'pharaoh', 'black'], ['h8', 'chariot', 'black'],
  ]);
  g.positionCounts = {};
  g._recordPosition();
  play(g, 'a1-a2', 'h8-h7', 'a2-a1', 'h7-h8', 'a1-a2', 'h8-h7', 'a2-a1');
  assert.strictEqual(g.currentTurn, 'black');
  const t = AI.bestTurn(g, 2);
  assert.strictEqual(E.squareName(t.from) + E.squareName(t.move.to), 'h7h8');
  play(g, 'h7-h8');
  assert.strictEqual(g.drawReason, 'threefold repetition');
});

// ── Pyramid blessing & promoted resurrection ───────────────────────────────

const targets = (board, from) => E.getRawMoves(sq(from), board, null).map(m => E.squareName(m.to)).sort();

test('Blessing of the Pyramid: pieces on d4–e5 may also step one square any way', () => {
  const b = new Array(64).fill(null);
  b[sq('d4')] = { type: 'sphinx', color: 'white' };
  b[sq('h1')] = { type: 'chariot', color: 'white' };
  b[sq('e5')] = { type: 'chariot', color: 'black' };
  // Orthogonal single steps are normally impossible for a Sphinx
  for (const s of ['d5', 'd3', 'c4', 'e4']) assert.ok(targets(b, 'd4').includes(s), s);
  // Black Chariot on e5 gains diagonal steps, including capturing onto d4
  for (const s of ['d4', 'f6', 'd6', 'f4']) assert.ok(targets(b, 'e5').includes(s), s);
  // Off the Pyramid there is no blessing
  assert.ok(!targets(b, 'h1').includes('g2'));
});

test('blessed Soldiers can step sideways and back', () => {
  const b = new Array(64).fill(null);
  b[sq('e4')] = { type: 'soldier', color: 'white' };
  assert.strictEqual(targets(b, 'e4').join(), 'd3,d4,d5,e3,e5,f3,f4,f5');
});

test('a blessed piece gives check with its step', () => {
  const g = emptyGame([
    ['e1', 'pharaoh', 'white'], ['e4', 'priest', 'white'],
    ['f4', 'pharaoh', 'black'],
  ], 'black');
  assert.ok(E.isInCheck('black', g.board)); // a Priest alone could never attack f4 from e4
  assert.ok(!E.isInCheck('black', emptyGame([
    ['e1', 'pharaoh', 'white'], ['b4', 'priest', 'white'], ['f4', 'pharaoh', 'black'],
  ]).board));
});

test('a captured promoted piece is lost, and resurrected, as a Soldier', () => {
  const g = emptyGame([
    ['a7', 'soldier', 'white'], ['e1', 'pharaoh', 'white'],
    ['h8', 'pharaoh', 'black'], ['b7', 'chariot', 'black'],
  ]);
  play(g, 'a7-a8');
  g.promotePiece('vizier');
  assert.ok(g.board[sq('a8')].promoted);
  const r = play(g, 'b7-b8', 'e1-d1', 'b8-a8');
  assert.strictEqual(r.record.captured, 'vizier');           // the log shows what was taken
  assert.strictEqual(g.capturedBy.black.at(-1).type, 'soldier'); // the tray and Ankh see a Soldier
  play(g, 'd1-e1', 'a8-a2');
  // White resurrects: it comes back as a Soldier
  g.activateAnkh();
  assert.strictEqual(g.clickSquare(sq('c2')).action, 'ankh_placed');
  assert.strictEqual(JSON.stringify(g.board[sq('c2')]), '{"type":"soldier","color":"white"}');
});

test('computer search state also returns promoted pieces as Soldiers', () => {
  const g = emptyGame([
    ['a8', 'vizier', 'white'], ['e1', 'pharaoh', 'white'],
    ['h8', 'pharaoh', 'black'], ['b8', 'chariot', 'black'],
  ], 'black');
  g.board[sq('a8')].promoted = true;
  const state = AI.fromGame(g);
  const t = AI.generate(state).find(t => t.from === sq('b8') && t.move.to === sq('a8'));
  assert.strictEqual(JSON.stringify(AI.apply(state, t).lost.white), '["soldier"]');
});

// ── Save / restore ─────────────────────────────────────────────────────────

test('a saved move list replays to the identical game', () => {
  const g = new GameState();
  play(g, 'e2-e4', 'a7-a6', 'e4-e5', 'd7-d5', 'e5-d6');          // en passant
  play(g, 'c7-d6', 'd1-g4', 'c8-g4');                              // captures: White lost a Vizier
  g.activateAnkh(); g.clickSquare(sq('d1'));                      // resurrection
  const restored = GameState.fromMoveList(JSON.parse(JSON.stringify(g.moveList())));
  for (const k of ['board', 'currentTurn', 'capturedBy', 'ankhUsed', 'epTarget', 'status', 'history', 'positionCounts', 'halfmoveClock']) {
    assert.strictEqual(JSON.stringify(restored[k]), JSON.stringify(g[k]), k);
  }
  assert.strictEqual(restored.undoStack.length, g.undoStack.length);
  restored.undo();
  assert.strictEqual(restored.ankhUsed.white, false);
});

test('promotions, including one still awaiting a choice, survive a save', () => {
  // Saves replay from the initial position, so play a real game that promotes twice
  const real = new GameState();
  play(real, 'b2-b4', 'a7-a5', 'b4-a5', 'h7-h6', 'a5-a6', 'h6-h5', 'a6-b7', 'h5-h4', 'b7-a8');
  real.promotePiece('chariot');
  play(real, 'h4-h3', 'g2-h3', 'g7-g5', 'h3-h4', 'g5-g4', 'h4-h5', 'g4-g3', 'h5-h6', 'g3-f2', 'e1-f2', 'b8-c6', 'h6-h7', 'c6-e5', 'h7-g8');
  assert.ok(real.pendingPromotion);
  const list = real.moveList();
  assert.strictEqual(list[8].promo, 'chariot');
  const restored = GameState.fromMoveList(list);
  assert.ok(restored.pendingPromotion);
  assert.strictEqual(restored.board[sq('a8')].type, 'chariot');
  assert.ok(restored.board[sq('a8')].promoted);
});

test('invalid or tampered saves are rejected', () => {
  assert.strictEqual(GameState.fromMoveList(null), null);
  assert.strictEqual(GameState.fromMoveList([{ from: sq('e2'), to: sq('e5') }]), null);   // illegal
  assert.strictEqual(GameState.fromMoveList([{ from: sq('e7'), to: sq('e5') }]), null);   // wrong side
  assert.strictEqual(GameState.fromMoveList([{ ankh: sq('e2') }]), null);                // nothing lost
  assert.strictEqual(GameState.fromMoveList([{ from: 'x' }]), null);
  assert.ok(GameState.fromMoveList([]));
});

test('undoStack[n] is the position after n moves (used to review the game)', () => {
  const g = new GameState();
  const boards = [JSON.stringify(g.board)];
  for (const m of ['e2-e4', 'd7-d5', 'e4-d5', 'd8-d5', 'b1-c3']) {
    play(g, m);
    boards.push(JSON.stringify(g.board));
  }
  g.activateAnkh(); g.clickSquare(sq('d8'));   // Black brings back its Soldier
  boards.push(JSON.stringify(g.board));
  assert.strictEqual(g.undoStack.length, g.history.length);
  g.undoStack.forEach((snap, n) => assert.strictEqual(JSON.stringify(snap.board), boards[n], `after ${n} moves`));
});
