class GameState {
  constructor() {
    this.board = this._initBoard();
    this.currentTurn = COLORS.WHITE;
    this.capturedBy = { white: [], black: [] }; // pieces captured BY each side
    this.ankhUsed = { white: false, black: false };
    this.ankhMode = false;
    this.epTarget = null;
    this.status = 'playing'; // 'playing' | 'check' | 'checkmate' | 'stalemate'
    this.winner = null;
    this.history = [];
    this.selectedIdx = null;
    this.legalMoves = [];
    this.pendingPromotion = null; // { square, color }
  }

  _initBoard() {
    const board = new Array(64).fill(null);
    const back = [
      PIECES.CHARIOT, PIECES.SPHINX, PIECES.PRIEST, PIECES.VIZIER,
      PIECES.PHARAOH, PIECES.PRIEST, PIECES.SPHINX, PIECES.CHARIOT
    ];
    for (let c = 0; c < 8; c++) {
      board[rcToIdx(0, c)] = { type: back[c], color: COLORS.BLACK };
      board[rcToIdx(1, c)] = { type: PIECES.SOLDIER, color: COLORS.BLACK };
      board[rcToIdx(6, c)] = { type: PIECES.SOLDIER, color: COLORS.WHITE };
      board[rcToIdx(7, c)] = { type: back[c], color: COLORS.WHITE };
    }
    return board;
  }

  clickSquare(idx) {
    if (this.status === 'checkmate' || this.status === 'stalemate') return { action: 'gameover' };
    if (this.pendingPromotion) return { action: 'awaiting_promotion' };

    if (this.ankhMode) {
      return this._handleAnkhPlacement(idx);
    }

    const piece = this.board[idx];

    if (this.selectedIdx === idx) {
      this.selectedIdx = null;
      this.legalMoves = [];
      return { action: 'deselect' };
    }

    if (this.selectedIdx !== null) {
      const move = this.legalMoves.find(m => m.to === idx);
      if (move) return this._executeMove(this.selectedIdx, move);

      if (piece?.color === this.currentTurn) {
        this.selectedIdx = idx;
        this.legalMoves = getLegalMoves(idx, this.board, this.epTarget);
        return { action: 'select' };
      }

      this.selectedIdx = null;
      this.legalMoves = [];
      return { action: 'deselect' };
    }

    if (piece?.color === this.currentTurn) {
      this.selectedIdx = idx;
      this.legalMoves = getLegalMoves(idx, this.board, this.epTarget);
      return { action: 'select' };
    }

    return { action: 'none' };
  }

  _executeMove(from, move) {
    const piece = this.board[from];
    const captured = this.board[move.to];
    const { row: toRow, col: toCol } = idxToRC(move.to);

    const record = {
      from, to: move.to,
      piece: piece.type, color: piece.color,
      captured: captured?.type ?? null,
      notation: this._notation(from, move.to, piece, captured)
    };

    // Capture
    if (captured) this.capturedBy[this.currentTurn].push({ ...captured });

    // En passant capture
    if (move.special === 'enPassant') {
      const capRow = piece.color === COLORS.WHITE ? toRow + 1 : toRow - 1;
      const epPiece = this.board[rcToIdx(capRow, toCol)];
      if (epPiece) this.capturedBy[this.currentTurn].push({ ...epPiece });
      this.board[rcToIdx(capRow, toCol)] = null;
    }

    // En passant target update
    this.epTarget = move.special === 'doublePush'
      ? rcToIdx(toRow + (piece.color === COLORS.WHITE ? 1 : -1), toCol)
      : null;

    // Execute
    this.board[move.to] = { ...piece };
    this.board[from] = null;

    // Pawn promotion
    const promoteRow = piece.color === COLORS.WHITE ? 0 : 7;
    if (piece.type === PIECES.SOLDIER && toRow === promoteRow) {
      this.pendingPromotion = { square: move.to, color: piece.color };
      this.history.push(record);
      this.selectedIdx = null;
      this.legalMoves = [];
      return { action: 'promotion', record };
    }

    this.history.push(record);
    this.selectedIdx = null;
    this.legalMoves = [];
    this._finishTurn();
    return { action: 'move', record };
  }

  promotePiece(type) {
    if (!this.pendingPromotion) return;
    const { square, color } = this.pendingPromotion;
    this.board[square] = { type, color };
    this.pendingPromotion = null;
    this._finishTurn();
  }

  _finishTurn() {
    this.currentTurn = this.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    this._updateStatus();
  }

  _updateStatus() {
    const inCheck = isInCheck(this.currentTurn, this.board);
    const hasLegal = this._hasAnyLegal(this.currentTurn);
    if (!hasLegal) {
      this.status = inCheck ? 'checkmate' : 'stalemate';
      this.winner = inCheck
        ? (this.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE)
        : null;
    } else {
      this.status = inCheck ? 'check' : 'playing';
    }
  }

  _hasAnyLegal(color) {
    for (let i = 0; i < 64; i++) {
      if (this.board[i]?.color === color && getLegalMoves(i, this.board, this.epTarget).length > 0) return true;
    }
    return false;
  }

  activateAnkh() {
    if (this.ankhUsed[this.currentTurn]) return false;
    if (!this._getAnkhPiece()) return false;
    if (this.status === 'checkmate' || this.status === 'stalemate') return false;
    this.ankhMode = true;
    this.selectedIdx = null;
    this.legalMoves = [];
    return true;
  }

  cancelAnkh() {
    this.ankhMode = false;
  }

  _getAnkhPiece() {
    // capturedBy[opp] holds pieces captured BY opponent = our own pieces we lost
    const opp = this.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const list = this.capturedBy[opp];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].type !== PIECES.PHARAOH) return { piece: list[i], listOwner: opp, idx: i };
    }
    return null;
  }

  _handleAnkhPlacement(targetIdx) {
    const found = this._getAnkhPiece();
    if (!found) { this.ankhMode = false; return { action: 'none' }; }

    const { row } = idxToRC(targetIdx);
    const validRows = this.currentTurn === COLORS.WHITE ? [6, 7] : [0, 1];
    if (!validRows.includes(row) || this.board[targetIdx] !== null) {
      return { action: 'ankh_invalid' };
    }

    // Temporarily place and check legality (piece retains its original color = currentTurn)
    this.board[targetIdx] = { ...found.piece };
    if (isInCheck(this.currentTurn, this.board)) {
      this.board[targetIdx] = null;
      return { action: 'ankh_invalid' };
    }

    this.capturedBy[found.listOwner].splice(found.idx, 1);
    this.ankhUsed[this.currentTurn] = true;
    this.ankhMode = false;
    this.epTarget = null;

    this.history.push({
      from: -1, to: targetIdx,
      piece: found.piece.type, color: this.currentTurn,
      captured: null,
      notation: `☥${PIECE_NAMES[found.piece.type][0]}→${_squareName(targetIdx)}`
    });

    this._finishTurn();
    return { action: 'ankh_placed' };
  }

  _notation(from, to, piece, captured) {
    const cap = captured ? 'x' : '-';
    return `${PIECE_NAMES[piece.type][0]}${_squareName(from)}${cap}${_squareName(to)}`;
  }

  reset() {
    Object.assign(this, new GameState());
  }
}

function _squareName(idx) {
  const { row, col } = idxToRC(idx);
  return 'abcdefgh'[col] + (8 - row);
}
