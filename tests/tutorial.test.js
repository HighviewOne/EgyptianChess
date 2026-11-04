// Tutorial lesson logic, checked against the real engine. Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(['engine.js', 'tutorial.js']
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n'), ctx);
const E = ctx.window.PharaohEngine;
const T = ctx.window.PharaohTutorial;
const lesson = id => T.LESSONS.find(l => l.id === id);
const start = id => T.boardFrom(lesson(id).pieces);
const sq = T.sq;

test('there are three lessons: Sphinx, Ankh, Pyramid', () => {
  assert.deepStrictEqual([...T.LESSONS.map(l => l.id)], ['sphinx', 'ankh', 'pyramid']);
});

test('Sphinx: only the diagonal slide reaches d4, and it solves the lesson', () => {
  const L = lesson('sphinx'), b = start('sphinx');
  const r = T.tryMove(L, b, sq('b2'), sq('d4'));
  assert.ok(r && r.solved);
  // Without the slide (a plain knight) d4 is out of reach from b2
  const knightJumps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
    .map(([dr, dc]) => [6 + dr, 1 + dc]).filter(([r2, c]) => r2 >= 0 && r2 < 8 && c >= 0 && c < 8)
    .map(([r2, c]) => E.rcToIdx(r2, c));
  assert.ok(!knightJumps.includes(sq('d4')));
  // Another legal move is allowed but doesn't solve it; an illegal one is refused
  assert.strictEqual(T.tryMove(L, b, sq('b2'), sq('c4')).solved, false);
  assert.strictEqual(T.tryMove(L, b, sq('b2'), sq('b5')), null);
});

test('Ankh: without it White is checkmated; blocking on rank 1 saves the game', () => {
  const L = lesson('ankh'), b = start('ankh');
  assert.ok(E.isInCheck('white', b));
  const moves = b.reduce((n, p, i) => n + (p && p.color === 'white' ? E.getLegalMoves(i, b, null).length : 0), 0);
  assert.strictEqual(moves, 0, 'no ordinary move escapes, so this would be mate');
  assert.deepStrictEqual([...T.ankhTargets(L, b).map(E.squareName)], ['b1', 'c1', 'd1', 'e1', 'f1', 'g1']);
  assert.ok(T.tryAnkh(L, b, sq('e1')).solved);
  assert.strictEqual(T.tryAnkh(L, b, sq('h2')), null, 'does not block the check');
  assert.strictEqual(T.tryAnkh(L, b, sq('e4')), null, 'not on the back two ranks');
});

test('Pyramid: the Chariot on d4 may step diagonally and capture on e5', () => {
  const L = lesson('pyramid'), b = start('pyramid');
  const r = T.tryMove(L, b, sq('d4'), sq('e5'));
  assert.ok(r && r.solved);
  // Off the Pyramid the same Chariot has no diagonal steps
  const off = T.boardFrom([['c3', 'chariot', 'white'], ['d4', 'sphinx', 'black'], ['h1', 'pharaoh', 'white'], ['h8', 'pharaoh', 'black']]);
  assert.strictEqual(T.tryMove(L, off, sq('c3'), sq('d4')), null);
});
