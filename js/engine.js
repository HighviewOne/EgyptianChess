// Pharaoh's Chess — game engine
// Ported and tightened from the original repo logic.
(function () {
const PIECES = {
  PHARAOH: 'pharaoh',
  VIZIER: 'vizier',
  CHARIOT: 'chariot',
  PRIEST: 'priest',
  SPHINX: 'sphinx',
  SOLDIER: 'soldier'
};

const COLORS = { WHITE: 'white', BLACK: 'black' };

const PIECE_NAMES = {
  pharaoh: 'Pharaoh', vizier: 'Vizier', chariot: 'Chariot',
  priest: 'Priest', sphinx: 'Sphinx', soldier: 'Soldier'
};

// Unique move-log symbols (first letters collide for Pharaoh/Priest; Soldiers are unmarked)
const PIECE_SYMBOLS = {
  pharaoh: 'Ph', vizier: 'V', chariot: 'C', priest: 'Pr', sphinx: 'S', soldier: ''
};

const PIECE_VALUES = { pharaoh: 0, vizier: 9, chariot: 5, priest: 3, sphinx: 4, soldier: 1 };

// d5, e5, d4, e4 (center pyramid zone)
const PYRAMID_SQUARES = new Set([27, 28, 35, 36]);

const idxToRC = (i) => ({ row: Math.floor(i / 8), col: i % 8 });
const rcToIdx = (r, c) => r * 8 + c;
const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

function squareName(idx) {
  const { row, col } = idxToRC(idx);
  return 'abcdefgh'[col] + (8 - row);
}

function getRawMoves(idx, board, epTarget) {
  const piece = board[idx];
  if (!piece) return [];
  const { row, col } = idxToRC(idx);
  const moves = [];
  switch (piece.type) {
    case PIECES.PHARAOH:
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const r = row + dr, c = col + dc;
        if (onBoard(r, c) && board[rcToIdx(r,c)]?.color !== piece.color) {
          moves.push({ to: rcToIdx(r, c), special: null });
        }
      }
      break;
    case PIECES.VIZIER:
      addSlide(row, col, piece.color, board, moves, [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]);
      break;
    case PIECES.CHARIOT:
      addSlide(row, col, piece.color, board, moves, [[-1,0],[1,0],[0,-1],[0,1]]);
      break;
    case PIECES.PRIEST:
      addSlide(row, col, piece.color, board, moves, [[-1,-1],[-1,1],[1,-1],[1,1]]);
      break;
    case PIECES.SPHINX:
      // Knight jumps
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const r = row + dr, c = col + dc;
        if (onBoard(r, c) && board[rcToIdx(r,c)]?.color !== piece.color) {
          moves.push({ to: rcToIdx(r, c), special: null });
        }
      }
      // 1–2 sq diagonal slide (no jumping)
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        for (let dist = 1; dist <= 2; dist++) {
          const r = row + dr * dist, c = col + dc * dist;
          if (!onBoard(r, c)) break;
          const target = board[rcToIdx(r, c)];
          if (target) {
            if (target.color !== piece.color) moves.push({ to: rcToIdx(r, c), special: null });
            break;
          }
          moves.push({ to: rcToIdx(r, c), special: null });
        }
      }
      break;
    case PIECES.SOLDIER: {
      const dir = piece.color === COLORS.WHITE ? -1 : 1;
      const startRow = piece.color === COLORS.WHITE ? 6 : 1;
      const r1 = row + dir;
      if (onBoard(r1, col) && !board[rcToIdx(r1, col)]) {
        moves.push({ to: rcToIdx(r1, col), special: null });
        const r2 = row + dir * 2;
        if (row === startRow && !board[rcToIdx(r2, col)]) {
          moves.push({ to: rcToIdx(r2, col), special: 'doublePush' });
        }
      }
      for (const dc of [-1, 1]) {
        const c = col + dc;
        if (!onBoard(r1, c)) continue;
        const t = board[rcToIdx(r1, c)];
        if (t?.color && t.color !== piece.color) {
          moves.push({ to: rcToIdx(r1, c), special: null });
        }
        if (epTarget !== null && rcToIdx(r1, c) === epTarget) {
          moves.push({ to: rcToIdx(r1, c), special: 'enPassant' });
        }
      }
      break;
    }
  }
  return moves;
}

function addSlide(row, col, color, board, moves, dirs) {
  for (const [dr, dc] of dirs) {
    let r = row + dr, c = col + dc;
    while (onBoard(r, c)) {
      const t = board[rcToIdx(r, c)];
      if (t) {
        if (t.color !== color) moves.push({ to: rcToIdx(r, c), special: null });
        break;
      }
      moves.push({ to: rcToIdx(r, c), special: null });
      r += dr; c += dc;
    }
  }
}

function applyMove(from, moveObj, board) {
  const nb = [...board];
  const piece = nb[from];
  if (moveObj.special === 'enPassant') {
    const { row, col } = idxToRC(moveObj.to);
    const capRow = piece.color === COLORS.WHITE ? row + 1 : row - 1;
    nb[rcToIdx(capRow, col)] = null;
  }
  nb[moveObj.to] = { ...piece };
  nb[from] = null;
  return nb;
}

function findKing(color, board) {
  for (let i = 0; i < 64; i++) {
    if (board[i]?.type === PIECES.PHARAOH && board[i].color === color) return i;
  }
  return -1;
}

const KNIGHT_STEPS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const DIAGONALS    = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ORTHOGONALS  = [[-1,0],[1,0],[0,-1],[0,1]];

// Looks outward from the square for attackers instead of generating every enemy move.
// Valid for occupied squares (where a Soldier's diagonal capture applies), which is
// all the engine asks about: the Pharaoh's square after a move.
function isSquareAttacked(square, byColor, board) {
  const { row, col } = idxToRC(square);
  const at = (r, c) => onBoard(r, c) ? board[rcToIdx(r, c)] : null;
  const isEnemy = (p, ...types) => p && p.color === byColor && types.includes(p.type);

  for (const [dr, dc] of KNIGHT_STEPS) {
    if (isEnemy(at(row + dr, col + dc), PIECES.SPHINX)) return true;
  }
  for (const [dr, dc] of DIAGONALS) {
    // Adjacent: Pharaoh, Vizier, Priest, Sphinx
    const p1 = at(row + dr, col + dc);
    if (isEnemy(p1, PIECES.PHARAOH, PIECES.VIZIER, PIECES.PRIEST, PIECES.SPHINX)) return true;
    // Soldiers capture toward the far side: White from below, Black from above
    if (isEnemy(p1, PIECES.SOLDIER) && dr === (byColor === COLORS.WHITE ? 1 : -1)) return true;
    if (p1 || !onBoard(row + dr, col + dc)) continue;
    // Two away with an empty middle: Sphinx slide; further: Vizier/Priest rays
    let r = row + 2 * dr, c = col + 2 * dc;
    if (isEnemy(at(r, c), PIECES.SPHINX)) return true;
    while (onBoard(r, c)) {
      const p = board[rcToIdx(r, c)];
      if (p) { if (isEnemy(p, PIECES.VIZIER, PIECES.PRIEST)) return true; break; }
      r += dr; c += dc;
    }
  }
  for (const [dr, dc] of ORTHOGONALS) {
    let r = row + dr, c = col + dc, dist = 1;
    while (onBoard(r, c)) {
      const p = board[rcToIdx(r, c)];
      if (p) {
        if (isEnemy(p, PIECES.VIZIER, PIECES.CHARIOT)) return true;
        if (dist === 1 && isEnemy(p, PIECES.PHARAOH)) return true;
        break;
      }
      r += dr; c += dc; dist++;
    }
  }
  return false;
}

function isInCheck(color, board) {
  const k = findKing(color, board);
  if (k === -1) return false;
  const opp = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  return isSquareAttacked(k, opp, board);
}

function getLegalMoves(idx, board, epTarget) {
  const piece = board[idx];
  if (!piece) return [];
  return getRawMoves(idx, board, epTarget).filter(m => {
    const nb = applyMove(idx, m, board);
    return !isInCheck(piece.color, nb);
  });
}

function makeInitialBoard() {
  const b = new Array(64).fill(null);
  const back = [
    PIECES.CHARIOT, PIECES.SPHINX, PIECES.PRIEST, PIECES.VIZIER,
    PIECES.PHARAOH, PIECES.PRIEST, PIECES.SPHINX, PIECES.CHARIOT
  ];
  for (let c = 0; c < 8; c++) {
    b[rcToIdx(0, c)] = { type: back[c], color: COLORS.BLACK };
    b[rcToIdx(1, c)] = { type: PIECES.SOLDIER, color: COLORS.BLACK };
    b[rcToIdx(6, c)] = { type: PIECES.SOLDIER, color: COLORS.WHITE };
    b[rcToIdx(7, c)] = { type: back[c], color: COLORS.WHITE };
  }
  return b;
}

function notation(from, to, piece, captured) {
  const cap = captured ? 'x' : '-';
  return `${PIECE_SYMBOLS[piece.type]}${squareName(from)}${cap}${squareName(to)}`;
}

window.PharaohEngine = {
  PIECES, COLORS, PIECE_NAMES, PIECE_SYMBOLS, PIECE_VALUES, PYRAMID_SQUARES,
  idxToRC, rcToIdx, squareName,
  getRawMoves, getLegalMoves, applyMove,
  findKing, isInCheck, isSquareAttacked,
  makeInitialBoard, notation
};
})();
