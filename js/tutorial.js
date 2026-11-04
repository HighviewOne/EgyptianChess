// Pharaoh's Chess — guided tutorial: three short lessons, one per Egyptian rule.
// The lesson logic is pure (uses only the engine), so tests can run it without a page;
// the dialog wiring at the bottom only runs in a browser. It never touches the real game.
(function () {
const E = window.PharaohEngine;

const sq = (s) => E.rcToIdx(8 - Number(s[1]), 'abcdefgh'.indexOf(s[0]));
function boardFrom(pieces) {
  const b = Array(64).fill(null);
  for (const [s, type, color] of pieces) b[sq(s)] = { type, color };
  return b;
}
const whiteOn = (b, s, type) => b[sq(s)]?.color === 'white' && b[sq(s)].type === type;

const LESSONS = [
  {
    id: 'sphinx',
    glyph: '𓃬',
    title: 'The Sphinx',
    text: 'The Sphinx jumps like a knight, and it can also slide one or two squares diagonally, as long as nothing is in the way.',
    goal: 'Capture the black Vizier on d4 with your Sphinx.',
    pieces: [['b2', 'sphinx', 'white'], ['d4', 'vizier', 'black'], ['h1', 'pharaoh', 'white'], ['h8', 'pharaoh', 'black']],
    solved: (b) => whiteOn(b, 'd4', 'sphinx'),
    hint: 'A knight jump can’t reach d4 from b2. Try sliding diagonally.',
    done: 'A knight could never reach d4 from b2. The Sphinx slid there diagonally.'
  },
  {
    id: 'ankh',
    glyph: '☥',
    title: 'The Ankh',
    text: 'Once per game you may spend your turn to bring back your most recently lost piece, onto any empty square of your back two ranks. An unused Ankh can even save you from checkmate.',
    goal: 'The black Chariot checks your Pharaoh and he has nowhere to go. Press ☥ Use the Ankh, then place your lost Chariot to block the check.',
    pieces: [['a1', 'pharaoh', 'white'], ['a2', 'soldier', 'white'], ['b2', 'soldier', 'white'],
             ['h1', 'chariot', 'black'], ['h8', 'pharaoh', 'black']],
    lost: 'chariot',
    solved: (b) => !E.isInCheck('white', b),
    hint: 'That doesn’t block the check. Place it on rank 1, between the black Chariot and your Pharaoh.',
    done: 'Saved! Without the Ankh, that was checkmate.'
  },
  {
    id: 'pyramid',
    glyph: '△',
    title: 'The Pyramid',
    text: 'The four centre squares (d4, d5, e4, e5) are the Pyramid. A piece standing on one may also step one square in any direction, like the Pharaoh.',
    goal: 'A Chariot normally can’t move diagonally. From the Pyramid square d4, capture the black Sphinx on e5.',
    pieces: [['d4', 'chariot', 'white'], ['e5', 'sphinx', 'black'], ['h1', 'pharaoh', 'white'], ['h8', 'pharaoh', 'black']],
    solved: (b) => whiteOn(b, 'e5', 'chariot'),
    hint: 'From d4 the Chariot may take one step in any direction, diagonals included.',
    done: 'Blessed by the Pyramid, the Chariot stepped diagonally.'
  }
];

const legalTargets = (b, from) =>
  b[from]?.color === 'white' ? E.getLegalMoves(from, b, null) : [];

// Returns null if the move isn't legal, otherwise { board, solved }
function tryMove(lesson, b, from, to) {
  const move = legalTargets(b, from).find(m => m.to === to);
  if (!move) return null;
  const board = E.applyMove(from, move, b);
  return { board, solved: lesson.solved(board) };
}

// Empty back-two-rank squares where the lost piece may be placed without leaving check
function ankhTargets(lesson, b) {
  const out = [];
  for (let i = 48; i < 64; i++) {
    if (b[i]) continue;
    const nb = b.slice();
    nb[i] = { type: lesson.lost, color: 'white' };
    if (!E.isInCheck('white', nb)) out.push(i);
  }
  return out;
}
// Returns null if the square isn't a legal placement, otherwise { board, solved }
function tryAnkh(lesson, b, to) {
  if (!lesson.lost || b[to] || to < 48) return null;
  const board = b.slice();
  board[to] = { type: lesson.lost, color: 'white' };
  if (E.isInCheck('white', board)) return null;
  return { board, solved: lesson.solved(board) };
}

window.PharaohTutorial = { LESSONS, sq, boardFrom, legalTargets, tryMove, ankhTargets, tryAnkh };

if (typeof document === 'undefined') return;

// ── Dialog ─────────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const dialog = $('tutorial-dialog');
if (!dialog) return;
const boardEl = $('tutorial-board');
let lessonNo = 0, board = null, selected = null, ankhMode = false, ankhUsed = false, solved = false;
let focusIdx = 0, opener = null, resetTimer = null;

function say(text, kind = '') {
  const el = $('tutorial-feedback');
  el.textContent = text;
  el.className = 'tutorial-feedback' + (kind ? ' ' + kind : '');
}

function startLesson(n) {
  clearTimeout(resetTimer);
  lessonNo = n;
  const L = LESSONS[n];
  board = boardFrom(L.pieces);
  selected = null; ankhMode = false; ankhUsed = false; solved = false;
  focusIdx = sq(L.pieces[0][0]);
  $('tutorial-step').textContent = `Lesson ${n + 1} of ${LESSONS.length}`;
  $('tutorial-glyph').textContent = L.glyph;
  $('tutorial-title').textContent = L.title;
  $('tutorial-text').textContent = L.text;
  $('tutorial-goal').textContent = L.goal;
  $('tutorial-ankh').hidden = !L.lost;
  $('tutorial-ankh').disabled = false;
  $('tutorial-ankh').setAttribute('aria-pressed', 'false');
  $('tutorial-next').hidden = true;
  $('tutorial-next').textContent = n === LESSONS.length - 1 ? 'Play a game ⟶' : 'Next lesson ⟶';
  say('');
  render();
}

function squareLabel(i, piece, isTarget) {
  const name = E.squareName(i);
  const what = piece ? `${piece.color === 'white' ? 'White' : 'Black'} ${E.PIECE_NAMES[piece.type]}` : 'empty';
  return `${name}, ${what}${E.PYRAMID_SQUARES.has(i) ? ', Pyramid' : ''}${isTarget ? ', can move here' : ''}`;
}

function render() {
  const hadFocus = boardEl.contains(document.activeElement);
  const L = LESSONS[lessonNo];
  const targets = new Set(ankhMode ? ankhTargets(L, board)
    : selected !== null ? legalTargets(board, selected).map(m => m.to) : []);
  const kingCheck = E.isInCheck('white', board) ? E.findKing('white', board) : -1;
  boardEl.innerHTML = '';
  for (let i = 0; i < 64; i++) {
    const { row, col } = E.idxToRC(i);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
    el.dataset.idx = i;
    el.tabIndex = i === focusIdx ? 0 : -1;
    const piece = board[i];
    if (E.PYRAMID_SQUARES.has(i)) { el.classList.add('pyramid'); if (piece) el.classList.add('occupied'); }
    if (i === selected) el.classList.add('selected');
    if (i === kingCheck) el.classList.add('in-check');
    if (targets.has(i)) {
      if (ankhMode) el.classList.add('ankh-target');
      else {
        const dot = document.createElement('div');
        dot.className = piece ? 'move-cap' : 'move-dot';
        el.appendChild(dot);
      }
    }
    if (piece) {
      const pd = document.createElement('div');
      pd.className = `piece ${piece.color}`;
      pd.innerHTML = window.PIECE_SVGS[piece.type];
      el.appendChild(pd);
    }
    // Square names along the edges, since the lessons refer to squares like d4
    if (col === 0) el.insertAdjacentHTML('beforeend', `<span class="tut-coord rank" aria-hidden="true">${8 - row}</span>`);
    if (row === 7) el.insertAdjacentHTML('beforeend', `<span class="tut-coord file" aria-hidden="true">${'abcdefgh'[col]}</span>`);
    el.setAttribute('aria-label', squareLabel(i, piece, targets.has(i)));
    boardEl.appendChild(el);
  }
  if (hadFocus) boardEl.querySelector(`[data-idx="${focusIdx}"]`)?.focus();
}

function finish(result) {
  board = result.board;
  selected = null; ankhMode = false;
  const L = LESSONS[lessonNo];
  if (result.solved) {
    solved = true;
    say(`✓ ${L.done}`, 'good');
    $('tutorial-ankh').disabled = true;
    $('tutorial-next').hidden = false;
    render();
    $('tutorial-next').focus();
  } else {
    say(L.hint, 'hint');
    render();
    // Put the pieces back so the lesson can be tried again
    resetTimer = setTimeout(() => {
      board = boardFrom(L.pieces); ankhUsed = false;
      $('tutorial-ankh').disabled = false;
      render();
    }, 1400);
  }
}

function clickSquare(i) {
  if (solved) return;
  focusIdx = i;
  const L = LESSONS[lessonNo];
  if (ankhMode) {
    const result = tryAnkh(L, board, i);
    if (!result) {
      const backRanks = i >= 48 && !board[i];
      say(backRanks ? L.hint : 'The Ankh places a piece on an empty square of your back two ranks (1 and 2).', 'hint');
      return;
    }
    ankhUsed = true;
    $('tutorial-ankh').setAttribute('aria-pressed', 'false');
    $('tutorial-ankh').disabled = true;
    finish(result);
    return;
  }
  if (selected !== null && selected !== i) {
    const result = tryMove(L, board, selected, i);
    if (result) { finish(result); return; }
  }
  if (board[i]?.color === 'white' && selected !== i) {
    selected = i;
    if (!legalTargets(board, i).length) say(L.lost ? 'That piece can’t help here. Your Pharaoh is in check.' : 'That piece has no moves here.', 'hint');
    else say('');
  } else {
    selected = null;
  }
  render();
}

function toggleAnkh() {
  if (solved || ankhUsed) return;
  ankhMode = !ankhMode;
  selected = null;
  $('tutorial-ankh').setAttribute('aria-pressed', String(ankhMode));
  say(ankhMode ? `Your lost ${E.PIECE_NAMES[LESSONS[lessonNo].lost]} returns. Choose a glowing square.` : '');
  render();
}

function open() {
  opener = document.activeElement;
  dialog.classList.remove('hidden');
  startLesson(0);
  boardEl.querySelector('[tabindex="0"]')?.focus();
}
function close() {
  clearTimeout(resetTimer);
  dialog.classList.add('hidden');
  if (opener && document.contains(opener)) opener.focus();
}

boardEl.addEventListener('click', (e) => {
  const el = e.target.closest('.square');
  if (el) clickSquare(Number(el.dataset.idx));
});
boardEl.addEventListener('keydown', (e) => {
  const steps = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 };
  if (!(e.key in steps)) return;
  e.preventDefault();
  const { row, col } = E.idxToRC(focusIdx);
  const r = row + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0);
  const c = col + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0);
  if (r < 0 || r > 7 || c < 0 || c > 7) return;
  focusIdx = E.rcToIdx(r, c);
  for (const el of boardEl.children) el.tabIndex = Number(el.dataset.idx) === focusIdx ? 0 : -1;
  boardEl.children[focusIdx].focus();
});
$('tutorial-ankh').addEventListener('click', toggleAnkh);
$('tutorial-restart').addEventListener('click', () => startLesson(lessonNo));
$('tutorial-next').addEventListener('click', () => {
  if (lessonNo < LESSONS.length - 1) { startLesson(lessonNo + 1); boardEl.querySelector('[tabindex="0"]')?.focus(); }
  else close();
});
$('tutorial-close').addEventListener('click', close);
dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
for (const id of ['learn-btn', 'rules-learn-btn']) $(id)?.addEventListener('click', open);
})();
