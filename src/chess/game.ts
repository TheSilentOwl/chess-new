import { Board } from './board.ts'
import { CASTLING_SIDES, isEnPassantCapture, isSquareAttacked, pseudoLegalMoves } from './moves.ts'
import { buildSanCore, sanLetter, type HistoryEntry } from './notation.ts'
import type { Color, PieceType, Square } from './types.ts'
import { createPiece, otherColor, sq } from './types.ts'

export type GameResult = { outcome: 'checkmate' | 'stalemate'; loser: Color } | null

interface PendingEntry {
  sanCore: string
  color: Color
  from: Square
  to: Square
}

export class Game {
  board!: Board
  turn!: Color
  enPassantTarget!: Square | null
  result!: GameResult
  pendingPromotion!: { square: Square; color: Color } | null
  history!: HistoryEntry[]
  halfmoveClock!: number

  private pendingEntry!: PendingEntry | null

  constructor() {
    this.reset()
  }

  reset() {
    this.board = Board.initial()
    this.turn = 'white'
    this.enPassantTarget = null
    this.result = null
    this.pendingPromotion = null
    this.history = []
    this.halfmoveClock = 0
    this.pendingEntry = null
  }

  isInCheck(color: Color) {
    const kingSquare = this.board.findKing(color)
    if (kingSquare == null) return false
    return isSquareAttacked(this.board, kingSquare, otherColor(color))
  }

  legalMovesFrom(from: Square) {
    const piece = this.board.get(from)
    if (piece == null) return []

    return pseudoLegalMoves(this.board, from, piece, this.enPassantTarget).filter((to) => {
      const simulated = this.board.clone()
      simulated.set(from, null)
      simulated.set(to, piece)
      if (isEnPassantCapture(this.board, piece, from, to)) {
        simulated.set(sq(to.file, from.rank), null)
      }
      const kingSquare = simulated.findKing(piece.color)
      if (kingSquare == null) return true
      return !isSquareAttacked(simulated, kingSquare, otherColor(piece.color))
    })
  }

  private hasAnyLegalMove(color: Color) {
    for (const [square, piece] of this.board.pieces()) {
      if (piece.color === color && this.legalMovesFrom(square).length > 0) return true
    }
    return false
  }

  makeMove(from: Square, to: Square, promotion?: PieceType) {
    const piece = this.board.get(from)
    if (piece == null) return

    const castleSide =
      piece.type === 'king' && Math.abs(to.file - from.file) === 2
        ? to.file > from.file
          ? 'kingside'
          : 'queenside'
        : null
    const isEnPassant = isEnPassantCapture(this.board, piece, from, to)
    const isCapture = this.board.get(to) != null || isEnPassant
    const sanCore = buildSanCore(this, piece, from, to, isCapture, castleSide)
    this.pendingEntry = { sanCore, color: piece.color, from, to }
    this.halfmoveClock = piece.type === 'pawn' || isCapture ? 0 : this.halfmoveClock + 1

    if (castleSide != null) this.performCastle(from, to)
    if (isEnPassant) this.board.set(sq(to.file, from.rank), null)

    this.board.set(from, null)
    piece.hasMoved = true
    this.board.set(to, piece)

    const isDoubleStep = piece.type === 'pawn' && Math.abs(to.rank - from.rank) === 2
    this.enPassantTarget = isDoubleStep ? sq(to.file, (from.rank + to.rank) / 2) : null

    const promotionRank = piece.color === 'white' ? 0 : 7
    if (piece.type === 'pawn' && to.rank === promotionRank) {
      this.pendingPromotion = { square: to, color: piece.color }
      if (promotion) this.resolvePromotion(promotion)
      return
    }

    this.advanceTurn()
  }

  resolvePromotion(type: PieceType) {
    if (this.pendingPromotion == null) return
    const { square, color } = this.pendingPromotion
    this.board.set(square, createPiece(type, color, true))
    this.pendingPromotion = null
    if (this.pendingEntry != null) this.pendingEntry.sanCore += `=${sanLetter(type)}`
    this.advanceTurn()
  }

  private performCastle(from: Square, to: Square) {
    const side = CASTLING_SIDES.find((s) => s.kingTo === to.file)
    if (side == null) return
    const rank = from.rank
    const rook = this.board.get(sq(side.rookFile, rank))
    if (rook == null) return
    this.board.set(sq(side.rookFile, rank), null)
    rook.hasMoved = true
    this.board.set(sq(side.rookTo, rank), rook)
  }

  private advanceTurn() {
    this.turn = otherColor(this.turn)

    if (!this.hasAnyLegalMove(this.turn)) {
      this.result = { outcome: this.isInCheck(this.turn) ? 'checkmate' : 'stalemate', loser: this.turn }
    }

    if (this.pendingEntry != null) {
      const isCheckmate = this.result?.outcome === 'checkmate'
      const isCheck = !isCheckmate && this.isInCheck(this.turn)
      const { sanCore, color, from, to } = this.pendingEntry
      const suffix = isCheckmate ? '#' : isCheck ? '+' : ''
      this.history.push({ san: sanCore + suffix, color, from, to })
      this.pendingEntry = null
    }
  }
}
