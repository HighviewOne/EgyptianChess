// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  const src = ['engine.js', 'game.js']
    .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'))
    .join('\n');
  vm.runInContext(src + '\nthis.GameState = GameState;', ctx);
  return { E: ctx.window.PharaohEngine, GameState: ctx.GameState };
}

const { E, GameState } = load();
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
