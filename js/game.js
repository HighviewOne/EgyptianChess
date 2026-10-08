// Destructure from the engine (loaded via engine.js → window.PharaohEngine)
const {
  PIECES, COLORS, PIECE_SYMBOLS,
  idxToRC, rcToIdx,
  getLegalMoves, isInCheck,
  makeInitialBoard, squareName
} = window.PharaohEngine;

const opponent = (color) => color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
const PROMOTION_TYPES = [PIECES.VIZIER, PIECES.CHARIOT, PIECES.PRIEST, PIECES.SPHINX];
const ankhRows = (color) => color === COLORS.WHITE ? [6, 7] : [0, 1];
// A captured promoted piece is lost (and resurrected) as the Soldier it was born
const lostAs = (piece) => piece.promoted
  ? { type: PIECES.SOLDIER, color: piece.color }
  : { type: piece.type, color: piece.color };

// Fields that make up a position; snapshotted for undo
const SNAPSHOT_KEYS = [
  'board', 'currentTurn', 'capturedBy', 'ankhUsed', 'epTarget', 'status', 'winner',
  'drawReason', 'history', 'lastFrom', 'lastTo', 'halfmoveClock', 'positionCounts'
];

class GameState {
  constructor() {
    this.board       = makeInitialBoard();
    this.currentTurn = COLORS.WHITE;
    this.capturedBy  = { white: [], black: [] };
    this.ankhUsed    = { white: false, black: false };
    this.ankhMode    = false;
    this.epTarget    = null;
    this.status      = 'playing';
    this.winner      = null;
    this.drawReason  = null;
    this.history     = [];
    this.selectedIdx = null;
    this.legalMoves  = [];
    this.pendingPromotion = null;
    this.lastFrom    = -1;
    this.lastTo      = -1;
    this.halfmoveClock  = 0;    // plies since the last capture, Soldier move, or resurrection
    this.positionCounts = {};   // position key → times reached (threefold repetition)
    this.undoStack   = [];
    this._recordPosition();
  }

  isOver() {
    return this.status === 'checkmate' || this.status === 'stalemate' || this.status === 'draw';
  }

  clickSquare(idx) {
    if (this.isOver()) return { action: 'gameover' };
    if (this.pendingPromotion) return { action: 'awaiting_promotion' };

    if (this.ankhMode) return this._handleAnkhPlacement(idx);

    const piece = this.board[idx];

    if (this.selectedIdx === idx) {
      this.selectedIdx = null; this.legalMoves = [];
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
      this.selectedIdx = null; this.legalMoves = [];
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
    this._pushUndo();
    const piece    = this.board[from];
    const { row: toRow, col: toCol } = idxToRC(move.to);
    const epIdx    = move.special === 'enPassant'
      ? rcToIdx(piece.color === COLORS.WHITE ? toRow + 1 : toRow - 1, toCol)
      : -1;
    const captured = epIdx !== -1 ? this.board[epIdx] : this.board[move.to];

    const record = {
      from, to: move.to,
      piece: piece.type, color: piece.color,
      captured: captured?.type ?? null,
      notation: window.PharaohEngine.notation(from, move.to, piece, captured)
    };

    if (captured) this.capturedBy[this.currentTurn].push(lostAs(captured));
    if (epIdx !== -1) this.board[epIdx] = null;

    this.epTarget = move.special === 'doublePush'
      ? rcToIdx(toRow + (piece.color === COLORS.WHITE ? 1 : -1), toCol)
      : null;

    this.board[move.to] = { ...piece };
    this.board[from] = null;
    this.lastFrom = from;
    this.lastTo   = move.to;
    this.halfmoveClock = (captured || piece.type === PIECES.SOLDIER) ? 0 : this.halfmoveClock + 1;
    this.history.push(record);
    this.selectedIdx = null; this.legalMoves = [];

    // Promotion
    const promoteRow = piece.color === COLORS.WHITE ? 0 : 7;
    if (piece.type === PIECES.SOLDIER && toRow === promoteRow) {
      this.pendingPromotion = { square: move.to, color: piece.color };
      return { action: 'promotion', record };
    }

    this._finishTurn();
    return { action: 'move', record, captured };
  }

  promotePiece(type) {
    if (!this.pendingPromotion) return;
    const { square, color } = this.pendingPromotion;
    this.board[square] = { type, color, promoted: true };
    this.pendingPromotion = null;
    const last = this.history[this.history.length - 1];
    if (last) {
      last.promo = type;
      last.notation += `=${PIECE_SYMBOLS[type]}`;
    }
    this._finishTurn();
  }

  _finishTurn() {
    this.currentTurn = opponent(this.currentTurn);
    this._recordPosition();
    this._updateStatus();
    const last = this.history[this.history.length - 1];
    if (last && this.status === 'checkmate') last.notation += '#';
    else if (last && this.status === 'check') last.notation += '+';
  }

  _updateStatus() {
    const inCheck  = isInCheck(this.currentTurn, this.board);
    // An available Ankh placement is a legal turn, so it can escape mate or stalemate
    const hasLegal = this._hasAnyLegal(this.currentTurn) || this._hasLegalAnkh(this.currentTurn);
    this.winner = null;
    this.drawReason = null;
    if (!hasLegal) {
      this.status = inCheck ? 'checkmate' : 'stalemate';
      if (inCheck) this.winner = opponent(this.currentTurn);
      return;
    }
    const drawReason = this._drawReason();
    if (drawReason) {
      this.status = 'draw';
      this.drawReason = drawReason;
      return;
    }
    this.status = inCheck ? 'check' : 'playing';
  }

  _drawReason() {
    if ((this.positionCounts[this._positionKey()] || 0) >= 3) return 'threefold repetition';
    if (this.halfmoveClock >= 100) return 'fifty-move rule';
    if (this._insufficientMaterial()) return 'insufficient material';
    return null;
  }

  _insufficientMaterial() {
    // A pending resurrection can still bring material back
    for (const color of [COLORS.WHITE, COLORS.BLACK]) {
      if (!this.ankhUsed[color] && this._getAnkhPiece(color)) return false;
    }
    // Lone Pharaohs, or a single Priest (a bishop cannot force mate)
    const extra = this.board.filter(p => p && p.type !== PIECES.PHARAOH);
    return extra.length === 0 || (extra.length === 1 && extra[0].type === PIECES.PRIEST);
  }

  _positionKey() {
    // Board, side to move, en passant square, and what each side's Ankh could still bring back
    const board = this.board.map(p => p ? `${p.color[0]}${p.type}${p.promoted ? '*' : ''}` : '.').join(',');
    const ankh = [COLORS.WHITE, COLORS.BLACK]
      .map(c => this.ankhUsed[c] ? '-' : (this._getAnkhPiece(c)?.piece.type ?? ''))
      .join('|');
    return `${board} ${this.currentTurn} ${this.epTarget} ${ankh}`;
  }

  _recordPosition() {
    const key = this._positionKey();
    this.positionCounts[key] = (this.positionCounts[key] || 0) + 1;
  }

  _hasAnyLegal(color) {
    for (let i = 0; i < 64; i++) {
      if (this.board[i]?.color === color && getLegalMoves(i, this.board, this.epTarget).length > 0) return true;
    }
    return false;
  }

  // ── Undo ──────────────────────────────────────────────────────────────────

  _pushUndo() {
    const snap = {};
    for (const k of SNAPSHOT_KEYS) snap[k] = this[k];
    this.undoStack.push(JSON.parse(JSON.stringify(snap)));
  }

  canUndo() { return this.undoStack.length > 0; }

  // Take back the last turn (also cancels a pending promotion)
  undo() {
    const snap = this.undoStack.pop();
    if (!snap) return false;
    Object.assign(this, snap);
    this.ankhMode = false;
    this.pendingPromotion = null;
    this.selectedIdx = null; this.legalMoves = [];
    return true;
  }

  // ── Ankh ──────────────────────────────────────────────────────────────────

  activateAnkh() {
    if (this.ankhUsed[this.currentTurn]) return false;
    if (!this._getAnkhPiece()) return false;
    if (this.isOver() || this.pendingPromotion) return false;
    this.ankhMode = true;
    this.selectedIdx = null; this.legalMoves = [];
    return true;
  }

  cancelAnkh() { this.ankhMode = false; }

  _hasLegalAnkh(color) {
    if (this.ankhUsed[color]) return false;
    const found = this._getAnkhPiece(color);
    if (!found) return false;
    for (const r of ankhRows(color)) {
      for (let c = 0; c < 8; c++) {
        const idx = rcToIdx(r, c);
        if (this.board[idx]) continue;
        const nb = [...this.board];
        nb[idx] = { ...found.piece };
        if (!isInCheck(color, nb)) return true;
      }
    }
    return false;
  }

  _getAnkhPiece(color = this.currentTurn) {
    // capturedBy[opp] = pieces captured BY opponent = OUR lost pieces
    const opp = opponent(color);
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
    if (!ankhRows(this.currentTurn).includes(row)) return { action: 'ankh_invalid', reason: 'not_home' };
    if (this.board[targetIdx] !== null)           return { action: 'ankh_invalid', reason: 'occupied' };

    const nb = [...this.board];
    nb[targetIdx] = { ...found.piece };
    if (isInCheck(this.currentTurn, nb)) return { action: 'ankh_invalid', reason: 'check' };

    this._pushUndo();
    this.board = nb;
    this.capturedBy[found.listOwner].splice(found.idx, 1);
    this.ankhUsed[this.currentTurn] = true;
    this.ankhMode = false;
    this.epTarget = null;
    this.lastFrom = -1;
    this.lastTo   = targetIdx;
    this.halfmoveClock = 0;

    this.history.push({
      from: -1, to: targetIdx,
      piece: found.piece.type, color: this.currentTurn,
      captured: null,
      notation: `☥${PIECE_SYMBOLS[found.piece.type]}${squareName(targetIdx)}`
    });

    this._finishTurn();
    return { action: 'ankh_placed', piece: found.piece };
  }

  reset() {
    Object.assign(this, new GameState());
  }

  // ── Save / restore ────────────────────────────────────────────────────────
  // A game is saved as its turn list and rebuilt by replaying it, which also
  // restores undo, repetition counts, and Ankh state, and stays small.

  moveList() {
    return this.history.map(h => h.from === -1
      ? { ankh: h.to }
      : (h.promo ? { from: h.from, to: h.to, promo: h.promo } : { from: h.from, to: h.to }));
  }

  // Returns null if any turn is not legal, so a stale or corrupted save is ignored
  static fromMoveList(list) {
    if (!Array.isArray(list)) return null;
    const g = new GameState();
    for (const [i, t] of list.entries()) {
      if (g.isOver() || g.pendingPromotion) return null;
      if (t && Number.isInteger(t.ankh)) {
        if (!g.activateAnkh() || g.clickSquare(t.ankh).action !== 'ankh_placed') return null;
        continue;
      }
      if (!t || !Number.isInteger(t.from) || !Number.isInteger(t.to)) return null;
      if (g.board[t.from]?.color !== g.currentTurn) return null;
      g.clickSquare(t.from);
      const r = g.clickSquare(t.to);
      if (r.action === 'promotion') {
        // The last turn may still be waiting for its promotion choice
        if (PROMOTION_TYPES.includes(t.promo)) g.promotePiece(t.promo);
        else if (t.promo || i !== list.length - 1) return null;
      } else if (r.action !== 'move') {
        return null;
      }
    }
    return g;
  }
}
