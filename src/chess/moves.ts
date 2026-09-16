import type { Board } from './board.ts'
import type { Color, Piece, Square } from './types.ts'
import { isOnBoard, otherColor, sameSquare, sq } from './types.ts'

const KNIGHT_OFFSETS = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
]

const KING_OFFSETS = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
]

const ROOK_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const BISHOP_DIRECTIONS = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const QUEEN_DIRECTIONS = [...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS]

function offsetSquares(from: Square, offsets: number[][]) {
  return offsets.map(([df, dr]) => sq(from.file + df, from.rank + dr)).filter(isOnBoard)
}

function slidingSquares(board: Board, from: Square, color: Color, directions: number[][]) {
  const result: Square[] = []
  for (const [df, dr] of directions) {
    let file = from.file + df
    let rank = from.rank + dr
    while (isOnBoard(sq(file, rank))) {
      const occupant = board.get(sq(file, rank))
      if (occupant == null) {
        result.push(sq(file, rank))
      } else {
        if (occupant.color !== color) result.push(sq(file, rank))
        break
      }
      file += df
      rank += dr
    }
  }
  return result
}

function pawnForward(color: Color) {
  return color === 'white' ? -1 : 1
}

export function pawnAttackSquares(from: Square, color: Color) {
  const dr = pawnForward(color)
  return [sq(from.file - 1, from.rank + dr), sq(from.file + 1, from.rank + dr)].filter(isOnBoard)
}

export function attackSquares(board: Board, from: Square, piece: Piece) {
  switch (piece.type) {
    case 'pawn':
      return pawnAttackSquares(from, piece.color)
    case 'knight':
      return offsetSquares(from, KNIGHT_OFFSETS)
    case 'king':
      return offsetSquares(from, KING_OFFSETS)
    case 'rook':
      return slidingSquares(board, from, piece.color, ROOK_DIRECTIONS)
    case 'bishop':
      return slidingSquares(board, from, piece.color, BISHOP_DIRECTIONS)
    case 'queen':
      return slidingSquares(board, from, piece.color, QUEEN_DIRECTIONS)
  }
}

export function isSquareAttacked(board: Board, target: Square, byColor: Color) {
  for (const [square, piece] of board.pieces()) {
    if (piece.color !== byColor) continue
    if (attackSquares(board, square, piece).some((s) => sameSquare(s, target))) {
      return true
    }
  }
  return false
}

export function isEnPassantCapture(board: Board, piece: Piece, from: Square, to: Square) {
  return piece.type === 'pawn' && to.file !== from.file && board.get(to) == null
}

function pawnMoves(board: Board, from: Square, color: Color, enPassantTarget: Square | null) {
  const result: Square[] = []
  const dr = pawnForward(color)
  const oneStep = sq(from.file, from.rank + dr)

  if (isOnBoard(oneStep) && board.get(oneStep) == null) {
    result.push(oneStep)
    const startRank = color === 'white' ? 6 : 1
    const twoStep = sq(from.file, from.rank + 2 * dr)
    if (from.rank === startRank && board.get(twoStep) == null) result.push(twoStep)
  }

  for (const target of pawnAttackSquares(from, color)) {
    const occupant = board.get(target)
    if (occupant != null && occupant.color !== color) {
      result.push(target)
    } else if (enPassantTarget != null && sameSquare(target, enPassantTarget)) {
      result.push(target)
    }
  }

  return result
}

export const CASTLING_SIDES = [
  { rookFile: 7, rookTo: 5, kingTo: 6, emptyFiles: [5, 6], safeFiles: [5, 6] },
  { rookFile: 0, rookTo: 3, kingTo: 2, emptyFiles: [1, 2, 3], safeFiles: [2, 3] },
]

function castlingMoves(board: Board, from: Square, piece: Piece) {
  if (piece.hasMoved) return []
  const enemy = otherColor(piece.color)
  if (isSquareAttacked(board, from, enemy)) return []

  const rank = from.rank
  const result: Square[] = []

  for (const side of CASTLING_SIDES) {
    const rook = board.get(sq(side.rookFile, rank))
    if (rook?.type !== 'rook' || rook.color !== piece.color || rook.hasMoved) continue
    const pathClear = side.emptyFiles.every((file) => board.get(sq(file, rank)) == null)
    const pathSafe = side.safeFiles.every((file) => !isSquareAttacked(board, sq(file, rank), enemy))
    if (pathClear && pathSafe) result.push(sq(side.kingTo, rank))
  }

  return result
}

export function pseudoLegalMoves(board: Board, from: Square, piece: Piece, enPassantTarget: Square | null) {
  let targets: Square[]
  switch (piece.type) {
    case 'pawn':
      targets = pawnMoves(board, from, piece.color, enPassantTarget)
      break
    case 'king':
      targets = [...offsetSquares(from, KING_OFFSETS), ...castlingMoves(board, from, piece)]
      break
    default:
      targets = attackSquares(board, from, piece)
  }
  return targets.filter((s) => {
    const occupant = board.get(s)
    return occupant == null || occupant.color !== piece.color
  })
}
