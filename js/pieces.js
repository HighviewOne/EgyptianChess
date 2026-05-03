const PIECES = {
  PHARAOH: 'pharaoh',
  VIZIER: 'vizier',
  CHARIOT: 'chariot',
  PRIEST: 'priest',
  SPHINX: 'sphinx',
  SOLDIER: 'soldier'
};

const COLORS = { WHITE: 'white', BLACK: 'black' };

const PIECE_SYMBOLS = {
  white: { pharaoh: '♔', vizier: '♕', chariot: '♖', priest: '♗', sphinx: '♘', soldier: '♙' },
  black: { pharaoh: '♚', vizier: '♛', chariot: '♜', priest: '♝', sphinx: '♞', soldier: '♟' }
};

const PIECE_NAMES = {
  pharaoh: 'Pharaoh', vizier: 'Vizier', chariot: 'Chariot',
  priest: 'Priest', sphinx: 'Sphinx', soldier: 'Soldier'
};

const PIECE_VALUES = { pharaoh: 0, vizier: 9, chariot: 5, priest: 3, sphinx: 4, soldier: 1 };

// d5, e5, d4, e4 (center pyramid zone)
const PYRAMID_SQUARES = new Set([27, 28, 35, 36]);

function idxToRC(i) { return { row: Math.floor(i / 8), col: i % 8 }; }
function rcToIdx(r, c) { return r * 8 + c; }
function onBoard(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function getRawMoves(idx, board, epTarget) {
  const piece = board[idx];
  if (!piece) return [];
  const { row, col } = idxToRC(idx);
  const moves = [];
  switch (piece.type) {
    case PIECES.PHARAOH:  addKingMoves(row, col, piece.color, board, moves); break;
    case PIECES.VIZIER:   addSlideMoves(row, col, piece.color, board, moves, [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]); break;
    case PIECES.CHARIOT:  addSlideMoves(row, col, piece.color, board, moves, [[-1,0],[1,0],[0,-1],[0,1]]); break;
    case PIECES.PRIEST:   addSlideMoves(row, col, piece.color, board, moves, [[-1,-1],[-1,1],[1,-1],[1,1]]); break;
    case PIECES.SPHINX:   addSphinxMoves(row, col, piece.color, board, moves); break;
    case PIECES.SOLDIER:  addSoldierMoves(row, col, piece.color, board, moves, epTarget); break;
  }
  return moves;
}

function addKingMoves(row, col, color, board, moves) {
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const r = row + dr, c = col + dc;
    if (onBoard(r, c) && board[rcToIdx(r,c)]?.color !== color) {
      moves.push({ to: rcToIdx(r, c), special: null });
    }
  }
}

function addSlideMoves(row, col, color, board, moves, dirs) {
  for (const [dr, dc] of dirs) {
    let r = row + dr, c = col + dc;
    while (onBoard(r, c)) {
      const target = board[rcToIdx(r, c)];
      if (target) {
        if (target.color !== color) moves.push({ to: rcToIdx(r, c), special: null });
        break;
      }
      moves.push({ to: rcToIdx(r, c), special: null });
      r += dr; c += dc;
    }
  }
}

function addSphinxMoves(row, col, color, board, moves) {
  // Standard knight jumps
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const r = row + dr, c = col + dc;
    if (onBoard(r, c) && board[rcToIdx(r,c)]?.color !== color) {
      moves.push({ to: rcToIdx(r, c), special: null });
    }
  }
  // Egyptian bonus: 1–2 square diagonal slides (cannot jump over)
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    for (let dist = 1; dist <= 2; dist++) {
      const r = row + dr * dist, c = col + dc * dist;
      if (!onBoard(r, c)) break;
      const target = board[rcToIdx(r, c)];
      if (target) {
        if (target.color !== color) moves.push({ to: rcToIdx(r, c), special: null });
        break;
      }
      moves.push({ to: rcToIdx(r, c), special: null });
    }
  }
}

function addSoldierMoves(row, col, color, board, moves, epTarget) {
  const dir = color === COLORS.WHITE ? -1 : 1;
  const startRow = color === COLORS.WHITE ? 6 : 1;
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
    if (board[rcToIdx(r1, c)]?.color && board[rcToIdx(r1, c)].color !== color) {
      moves.push({ to: rcToIdx(r1, c), special: null });
    }
    if (epTarget !== null && rcToIdx(r1, c) === epTarget) {
      moves.push({ to: rcToIdx(r1, c), special: 'enPassant' });
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

function isSquareAttacked(square, byColor, board) {
  for (let i = 0; i < 64; i++) {
    if (board[i]?.color === byColor) {
      if (getRawMoves(i, board, null).some(m => m.to === square)) return true;
    }
  }
  return false;
}

function isInCheck(color, board) {
  const kingPos = findKing(color, board);
  if (kingPos === -1) return false;
  const opp = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  return isSquareAttacked(kingPos, opp, board);
}

function getLegalMoves(idx, board, epTarget) {
  const piece = board[idx];
  if (!piece) return [];
  return getRawMoves(idx, board, epTarget).filter(m => {
    const nb = applyMove(idx, m, board);
    return !isInCheck(piece.color, nb);
  });
}
