// AI fingerprint: the computer plays itself at a fixed depth (no clock, no noise, so the same
// moves every run) and the game must match the one recorded in tests/fixtures/fingerprint.json.
// Every 8 plies it also folds the exact score of every legal turn into a checksum, so an
// evaluation change fails here even when it doesn't change which move gets played.
//
// Meant the change? Re-record, look at the diff, and say why in the commit message:
//   UPDATE_FINGERPRINT=1 node --test tests/fingerprint.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(['engine.js', 'game.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'))
  .join('\n') + '\nthis.GameState = GameState;', ctx);
const AI = ctx.window.PharaohAI, GameState = ctx.GameState;

const FIXTURE = path.join(__dirname, 'fixtures', 'fingerprint.json');
const UPDATE = process.env.UPDATE_FINGERPRINT === '1';

// Each run starts from the opening position, or from a share code
const RUNS = {
  'depth 2, 80 plies': { depth: 2, plies: 80, opts: { quiesce: true } },
  'Expert options (memory, contempt), depth 3, 16 plies':
    { depth: 3, plies: 16, opts: { quiesce: true, memory: true, contempt: 25 } }
};

// FNV-1a over a string, as 8 hex digits
function fnv(str, h = 0x811c9dc5) {
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

function selfPlay({ depth, plies, opts, start = '' }) {
  const g = GameState.fromShareCode(start);
  let scores = 0x811c9dc5;
  for (let n = 0; n < plies && !g.isOver(); n++) {
    if (n % 8 === 0) scores = fnv(AI.analyse(g, 2).map(s => `${s.key}:${s.score}`).join(','), scores);
    const t = AI.bestTurn(g, depth, opts);
    if (!t) break;
    if (t.kind === 'ankh') {
      g.activateAnkh();
      g.clickSquare(t.to);
    } else {
      g.clickSquare(t.from);
      if (g.clickSquare(t.move.to).action === 'promotion') g.promotePiece(t.promo);
    }
  }
  const moves = g.toShareCode();
  // Rebuilding the game from its share code must reach the same position
  const replay = GameState.fromShareCode(moves);
  assert.ok(replay, 'the self-play game must replay from its share code');
  assert.strictEqual(AI.hashState(AI.fromGame(replay)), AI.hashState(AI.fromGame(g)), 'replay reached a different position');
  return { moves, hash: AI.hashState(AI.fromGame(g)), scores: scores.toString(16).padStart(8, '0'), over: g.isOver(), drawReason: g.drawReason };
}

const recorded = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : {};
const results = {};

for (const [name, run] of Object.entries(RUNS)) {
  test(`AI self-play fingerprint: ${name}`, () => {
    const got = selfPlay(run);
    results[name] = got;
    if (UPDATE) return;
    const want = recorded[name];
    assert.ok(want, `no recording for "${name}"; run with UPDATE_FINGERPRINT=1`);
    const a = got.moves.split('.'), b = want.moves.split('.');
    const i = a.findIndex((m, k) => m !== b[k]);
    assert.strictEqual(got.moves, want.moves,
      i < 0 ? 'game is shorter than recorded'
            : `first different move at ply ${i + 1}: got ${a[i]}, recorded ${b[i]}`);
    assert.strictEqual(got.scores, want.scores, 'same moves, but the AI scores turns differently (evaluation or search changed)');
    assert.deepStrictEqual(got, want);
  });
}

test.after(() => {
  if (!UPDATE) return;
  fs.writeFileSync(FIXTURE, JSON.stringify(results, null, 2) + '\n');
  console.log(`wrote ${path.relative(process.cwd(), FIXTURE)}`);
});
