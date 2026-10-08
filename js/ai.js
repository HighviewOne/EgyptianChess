// Pharaoh's Chess — computer opponent
// Alpha-beta search over a lightweight copy of the game, including Ankh resurrections.
(function () {
const E = window.PharaohEngine;
const { PIECES, COLORS } = E;

const VALUE = { pharaoh: 0, vizier: 900, chariot: 500, sphinx: 430, priest: 320, soldier: 100 };
const MATE = 100000;
const opp = (c) => c === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
const homeRows = (c) => c === COLORS.WHITE ? [6, 7] : [0, 1];

// ── Search state ────────────────────────────────────────────────────────────
// { board, turn, ep, ankhUsed: {white, black}, lost: {white: [types], black: [types]} }
// lost[c] = pieces colour c has lost, oldest first (the Ankh brings back the last one)

function fromGame(game) {
  return {
    board: game.board.map(p => p && { ...p }),
    turn: game.currentTurn,
    ep: game.epTarget,
    ankhUsed: { ...game.ankhUsed },
    lost: {
      white: game.capturedBy.black.map(p => p.type),
      black: game.capturedBy.white.map(p => p.type)
    }
  };
}

function ankhPiece(state, color) {
  if (state.ankhUsed[color]) return null;
  const list = state.lost[color];
  for (let i = list.length - 1; i >= 0; i--) if (list[i] !== PIECES.PHARAOH) return { type: list[i], i };
  return null;
}

// Every legal turn for the side to move: { kind: 'move', from, move, promo } or { kind: 'ankh', to }
function generate(state, capturesOnly = false) {
  const { board, turn, ep } = state;
  const out = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.color !== turn) continue;
    for (const move of E.getLegalMoves(i, board, ep)) {
      const victim = move.special === 'enPassant' ? PIECES.SOLDIER : board[move.to]?.type;
      const promotes = p.type === PIECES.SOLDIER && (move.to < 8 || move.to >= 56);
      if (capturesOnly && !victim && !promotes) continue;
      // Order: promotions, then captures by most valuable victim / least valuable attacker
      const order = (promotes ? 800 : 0) + (victim ? VALUE[victim] * 10 - VALUE[p.type] / 10 + 1 : 0);
      out.push({ kind: 'move', from: i, move, promo: promotes ? PIECES.VIZIER : null, order });
    }
  }
  if (!capturesOnly) {
    const ap = ankhPiece(state, turn);
    if (ap) {
      for (const r of homeRows(turn)) {
        for (let c = 0; c < 8; c++) {
          const to = E.rcToIdx(r, c);
          if (board[to]) continue;
          const nb = board.slice();
          nb[to] = { type: ap.type, color: turn };
          if (!E.isInCheck(turn, nb)) out.push({ kind: 'ankh', to, order: -1 });
        }
      }
    }
  }
  return out.sort((a, b) => b.order - a.order);
}

function apply(state, t) {
  const turn = state.turn;
  const board = state.board.slice();
  const lost = state.lost;
  let newLost = lost, ankhUsed = state.ankhUsed, ep = null;

  if (t.kind === 'ankh') {
    const ap = ankhPiece(state, turn);
    board[t.to] = { type: ap.type, color: turn };
    newLost = { ...lost, [turn]: lost[turn].filter((_, i) => i !== ap.i) };
    ankhUsed = { ...ankhUsed, [turn]: true };
  } else {
    const { from, move } = t;
    const piece = board[from];
    let victim = board[move.to];
    if (move.special === 'enPassant') {
      const capIdx = move.to + (turn === COLORS.WHITE ? 8 : -8);
      victim = board[capIdx];
      board[capIdx] = null;
    }
    if (move.special === 'doublePush') ep = (from + move.to) / 2;
    board[move.to] = t.promo ? { type: t.promo, color: turn, promoted: true } : piece;
    board[from] = null;
    if (victim) {
      const lostType = victim.promoted ? PIECES.SOLDIER : victim.type;
      newLost = { ...lost, [victim.color]: [...lost[victim.color], lostType] };
    }
  }
  return { board, turn: opp(turn), ep, ankhUsed, lost: newLost };
}

// ── Evaluation (from the side to move's point of view) ──────────────────────

const CENTER = [0, 1, 2, 3, 3, 2, 1, 0];

function evaluate(state) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (!p) continue;
    const row = i >> 3, col = i & 7;
    let v = VALUE[p.type];
    if (p.type === PIECES.SOLDIER) {
      const advance = p.color === COLORS.WHITE ? 6 - row : row - 1;
      v += advance * advance * 3 + (col >= 2 && col <= 5 ? advance * 4 : 0);
    } else if (p.type !== PIECES.PHARAOH) {
      v += (CENTER[row] + CENTER[col]) * (p.type === PIECES.CHARIOT ? 2 : 5);
      if (E.PYRAMID_SQUARES.has(i)) v += 15;   // blessed: extra king-step mobility
    } else {
      // Pharaoh prefers shelter on its own back rows
      const home = p.color === COLORS.WHITE ? row >= 6 : row <= 1;
      v += home ? 15 : -10;
    }
    score += p.color === state.turn ? v : -v;
  }
  // An unspent Ankh with something to bring back is worth part of that piece
  for (const color of [COLORS.WHITE, COLORS.BLACK]) {
    const ap = ankhPiece(state, color);
    if (ap) score += (color === state.turn ? 1 : -1) * VALUE[ap.type] * 0.4;
  }
  return score;
}

// ── Position fingerprints (Zobrist hashing) for the transposition table ─────

const ZOBRIST = (() => {
  let seed = 0x9e3779b9;
  const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const table = (n) => Array.from({ length: n }, () => [next(), next()]);
  return {
    piece: table(64 * 24),   // square × (colour, type, promoted)
    turn: next(), turn2: next(),
    ep: table(65),
    ankh: table(2 * 8)       // colour × (used, or top lost type, or nothing)
  };
})();
const TYPE_INDEX = { pharaoh: 0, vizier: 1, chariot: 2, priest: 3, sphinx: 4, soldier: 5 };

// A 53-bit fingerprint: two 32-bit Zobrist halves folded into one safe integer
function hashState(state) {
  let h1 = 0, h2 = 0;
  const { board } = state;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const z = ZOBRIST.piece[i * 24 + (p.color === COLORS.WHITE ? 0 : 12) + TYPE_INDEX[p.type] * 2 + (p.promoted ? 1 : 0)];
    h1 ^= z[0]; h2 ^= z[1];
  }
  if (state.turn === COLORS.BLACK) { h1 ^= ZOBRIST.turn; h2 ^= ZOBRIST.turn2; }
  const e = ZOBRIST.ep[state.ep ?? 64];
  h1 ^= e[0]; h2 ^= e[1];
  for (const [ci, color] of [[0, COLORS.WHITE], [1, COLORS.BLACK]]) {
    const ap = ankhPiece(state, color);
    const slot = state.ankhUsed[color] ? 7 : ap ? TYPE_INDEX[ap.type] + 1 : 0;
    const z = ZOBRIST.ankh[ci * 8 + slot];
    h1 ^= z[0]; h2 ^= z[1];
  }
  return (h1 >>> 0) * 2097152 + ((h2 >>> 0) & 0x1fffff);
}

const turnKey = (t) => t.kind === 'ankh' ? 4096 + t.to : t.from * 64 + t.move.to;
const isQuiet = (t) => t.order <= 0;   // not a capture or promotion

// ── Search ──────────────────────────────────────────────────────────────────

class Timeout extends Error {}

const EXACT = 0, LOWER = 1, UPPER = 2;
const TT_LIMIT = 400000;
// Mate scores are stored relative to the node so they stay right at any depth
const toTT   = (s, ply) => s > MATE - 1000 ? s + ply : s < -MATE + 1000 ? s - ply : s;
const fromTT = (s, ply) => s > MATE - 1000 ? s - ply : s < -MATE + 1000 ? s + ply : s;

// memory = { tt: Map, killers: [], history: Map } shared across depths of one search, or null
function makeSearcher(deadline, memory = null) {
  let nodes = 0;
  const tick = () => {
    if ((++nodes & 511) === 0 && Date.now() > deadline) throw new Timeout();
  };

  function quiesce(state, alpha, beta, depth) {
    tick();
    const inCheck = E.isInCheck(state.turn, state.board);
    if (!inCheck) {
      const stand = evaluate(state);
      if (stand >= beta || depth <= 0) return stand;
      if (stand > alpha) alpha = stand;
    }
    const turns = generate(state, !inCheck);
    if (inCheck && turns.length === 0) return -MATE;
    for (const t of turns) {
      const score = -quiesce(apply(state, t), -beta, -alpha, depth - 1);
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  // Best previous move first, then captures, then killer moves, then quiet moves by history
  function orderTurns(turns, ttMove, ply) {
    const killers = memory.killers[ply] || [];
    for (const t of turns) {
      const k = turnKey(t);
      t.rank = k === ttMove ? 1e9
        : !isQuiet(t) ? 1e7 + t.order
        : k === killers[0] ? 9e6 : k === killers[1] ? 8e6
        : (memory.history.get(k) || 0);
    }
    return turns.sort((a, b) => b.rank - a.rank);
  }

  function negamax(state, depth, alpha, beta, ply, useQuiesce) {
    tick();
    if (depth <= 0) return useQuiesce ? quiesce(state, alpha, beta, 6) : evaluate(state);

    let key = 0, ttMove = null;
    const alphaIn = alpha;
    if (memory) {
      key = hashState(state);
      const entry = memory.tt.get(key);
      if (entry) {
        ttMove = entry.move;
        if (entry.depth >= depth) {
          const s = fromTT(entry.score, ply);
          if (entry.flag === EXACT) return s;
          if (entry.flag === LOWER && s >= beta) return s;
          if (entry.flag === UPPER && s <= alpha) return s;
        }
      }
    }

    let turns = generate(state);
    if (turns.length === 0) return E.isInCheck(state.turn, state.board) ? -MATE + ply : 0;
    if (memory) turns = orderTurns(turns, ttMove, ply);

    let best = -Infinity, bestTurn = null;
    for (const t of turns) {
      const score = -negamax(apply(state, t), depth - 1, -beta, -alpha, ply + 1, useQuiesce);
      if (score > best) { best = score; bestTurn = t; }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (memory && isQuiet(t)) {
          const k = turnKey(t);
          const killers = memory.killers[ply] || (memory.killers[ply] = []);
          if (killers[0] !== k) { killers[1] = killers[0]; killers[0] = k; }
          memory.history.set(k, (memory.history.get(k) || 0) + depth * depth);
        }
        break;
      }
    }

    if (memory) {
      if (memory.tt.size > TT_LIMIT) memory.tt.clear();
      memory.tt.set(key, {
        depth, score: toTT(best, ply), move: turnKey(bestTurn),
        flag: best <= alphaIn ? UPPER : best >= beta ? LOWER : EXACT
      });
    }
    return best;
  }

  // Score every root turn at a fixed depth. With exact=false, turns after the best
  // only get an upper bound (cheaper); exact scores are needed when adding noise.
  function root(state, turns, depth, useQuiesce, exact, drawTurns) {
    let alpha = -Infinity;
    const scored = [];
    for (const t of turns) {
      const score = drawTurns.has(t) ? 0 : -negamax(apply(state, t), depth - 1, -Infinity, exact ? Infinity : -alpha, 1, useQuiesce);
      scored.push({ t, score });
      if (score > alpha) alpha = score;
    }
    return scored;
  }

  return { root };
}

const LEVELS = {
  easy:   { maxDepth: 1, timeMs: 300,  quiesce: false, noise: 90 },
  medium: { maxDepth: 2, timeMs: 800,  quiesce: true,  noise: 15 },
  hard:   { maxDepth: 6, timeMs: 1600, quiesce: true,  noise: 0 },
  // Remembers positions it has analysed and orders moves by what refuted before,
  // so it reaches deeper in the time; and it is given more time
  expert: { maxDepth: 12, timeMs: 4000, quiesce: true, noise: 0, memory: true }
};
// On the page's own thread (pages opened from disk) a long think would freeze it
const MAIN_THREAD_MS = 1600;
const inWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
const newMemory = () => ({ tt: new Map(), killers: [], history: new Map() });

// Root turns that would reach a position for the third time end the game in a draw
function repetitionDraws(game, state, turns) {
  const draws = new Set();
  for (const t of turns) {
    const next = apply(state, t);
    const probe = Object.assign(Object.create(GameState.prototype), {
      board: next.board, currentTurn: next.turn, epTarget: next.ep, ankhUsed: next.ankhUsed,
      capturedBy: {
        white: next.lost.black.map(type => ({ type, color: COLORS.BLACK })),
        black: next.lost.white.map(type => ({ type, color: COLORS.WHITE }))
      }
    });
    if ((game.positionCounts[probe._positionKey()] || 0) >= 2) draws.add(t);
  }
  return draws;
}

// Synchronous search, used by think() one depth at a time and directly by tests
function searchDepth(state, depth, opts, deadline, rootTurns, drawTurns, memory = null) {
  return makeSearcher(deadline, memory).root(state, rootTurns, depth, opts.quiesce, opts.noise > 0, drawTurns);
}

function pick(scored, noise, rand = Math.random) {
  let best = null, bestScore = -Infinity;
  for (const { t, score } of scored) {
    const s = score + (noise ? rand() * noise : 0);
    if (s > bestScore) { bestScore = s; best = t; }
  }
  return best;
}

// Best turn for a GameState, searching to a fixed depth (no time limit)
function bestTurn(game, depth, opts = { quiesce: true }) {
  const state = fromGame(game);
  const turns = generate(state);
  if (!turns.length) return null;
  return pick(searchDepth(state, depth, opts, Infinity, turns, repetitionDraws(game, state, turns),
    opts.memory ? newMemory() : null), 0);
}

// Every root turn's exact score at a fixed depth (tests compare searches with this)
function analyse(game, depth, { memory = false } = {}) {
  const state = fromGame(game);
  const turns = generate(state);
  return searchDepth(state, depth, { quiesce: true, noise: 1 }, Infinity, turns, new Set(), memory ? newMemory() : null)
    .map(({ t, score }) => ({ key: turnKey(t), score }));
}

// Iterative deepening that yields to the browser between depths so the page stays live.
// Calls done(turn) once; returns a cancel function.
function think(game, level, done) {
  const opts = LEVELS[level] || LEVELS.medium;
  const state = fromGame(game);
  let turns = generate(state);
  const drawTurns = repetitionDraws(game, state, turns);
  const memory = opts.memory ? newMemory() : null;
  const budget = inWorker || typeof window === 'undefined' || !window.document
    ? opts.timeMs : Math.min(opts.timeMs, MAIN_THREAD_MS);
  let cancelled = false;
  const started = Date.now();
  const deadline = started + budget;
  let lastScored = null;
  let depth = 1;

  const finish = () => {
    if (cancelled) return;
    cancelled = true;
    done(lastScored ? pick(lastScored, opts.noise) : turns[0] || null);
  };

  const step = () => {
    if (cancelled) return;
    if (turns.length <= 1) return finish();
    try {
      lastScored = searchDepth(state, depth, opts, deadline, turns, drawTurns, memory);
      // Re-order so the best turn so far is searched first next time
      const order = new Map(lastScored.map(s => [s.t, s.score]));
      turns = [...turns].sort((a, b) => order.get(b) - order.get(a));
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      return finish();
    }
    const mateFound = lastScored.some(s => s.score > MATE - 100);
    // The next depth takes several times longer; past half the budget it would rarely finish
    if (depth >= opts.maxDepth || mateFound || Date.now() - started > budget / 2) return finish();
    depth++;
    setTimeout(step, 0);
  };

  // Short pause first so the player's move renders before the search starts
  setTimeout(step, 30);
  return () => { cancelled = true; };
}

// Prefer a background thread so the page never stalls; browsers refuse workers for
// pages opened from file://, so fall back to think() on the main thread there.
let worker = null, requestId = 0;

function thinkInBackground(game, level, done) {
  const canUseWorker = typeof Worker !== 'undefined' && /^https?:$/.test(location.protocol);
  if (!worker && canUseWorker) {
    try { worker = new Worker('js/ai-worker.js'); } catch (_) { worker = null; }
  }
  if (!worker) return think(game, level, done);

  const id = ++requestId;
  const snapshot = {
    board: game.board, currentTurn: game.currentTurn, epTarget: game.epTarget,
    ankhUsed: game.ankhUsed, capturedBy: game.capturedBy, positionCounts: game.positionCounts
  };
  worker.onmessage = (e) => { if (e.data.id === id) done(e.data.turn); };
  worker.onerror = () => { worker = null; think(game, level, done); };
  worker.postMessage({ id, game: snapshot, level });
  // Cancelling stops the search outright; a fresh worker starts on the next request
  return () => { if (worker) { worker.terminate(); worker = null; } };
}

window.PharaohAI = { LEVELS, think, thinkInBackground, bestTurn, analyse, hashState, evaluate, generate, apply, fromGame };
})();
