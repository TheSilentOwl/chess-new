import type { Color, Piece, PieceType, Square } from './types.ts'
import { createPiece, isOnBoard } from './types.ts'

const BACK_RANK: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']

export class Board {
  private squares: (Piece | null)[][]

  constructor(squares?: (Piece | null)[][]) {
    this.squares = squares ?? Board.emptyGrid()
  }

  private static emptyGrid() {
    return Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null))
  }

  static initial() {
    const board = new Board()
    for (let file = 0; file < 8; file++) {
      board.set({ file, rank: 0 }, createPiece(BACK_RANK[file], 'black'))
      board.set({ file, rank: 1 }, createPiece('pawn', 'black'))
      board.set({ file, rank: 6 }, createPiece('pawn', 'white'))
      board.set({ file, rank: 7 }, createPiece(BACK_RANK[file], 'white'))
    }
    return board
  }

  get(s: Square) {
    if (!isOnBoard(s)) return null
    return this.squares[s.rank][s.file]
  }

  set(s: Square, piece: Piece | null) {
    this.squares[s.rank][s.file] = piece
  }

  clone() {
    return new Board(this.squares.map((row) => row.map((p) => (p ? { ...p } : null))))
  }

  *pieces(): IterableIterator<[Square, Piece]> {
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = this.squares[rank][file]
        if (piece) yield [{ file, rank }, piece]
      }
    }
  }

  findKing(color: Color) {
    for (const [square, piece] of this.pieces()) {
      if (piece.type === 'king' && piece.color === color) return square
    }
    return null
  }
}
