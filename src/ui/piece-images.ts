import type { Color, PieceType } from '../chess/types.ts'

const PIECE_LETTER: Record<PieceType, string> = {
  pawn: 'P',
  rook: 'R',
  knight: 'N',
  bishop: 'B',
  queen: 'Q',
  king: 'K',
}

export function pieceImageSrc(color: Color, type: PieceType) {
  return `assets/piece/chess7/${color === 'white' ? 'w' : 'b'}${PIECE_LETTER[type]}.svg`
}
