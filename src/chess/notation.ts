import type { Board } from './board.ts'
import type { Game } from './game.ts'
import type { Color, Piece, PieceType, Square } from './types.ts'
import { sameSquare } from './types.ts'

export interface HistoryEntry {
  san: string
  color: Color
  from: Square
  to: Square
}

const SAN_LETTER: Record<PieceType, string> = {
  pawn: '',
  knight: 'N',
  bishop: 'B',
  rook: 'R',
  queen: 'Q',
  king: 'K',
}

const FEN_LETTER: Record<PieceType, string> = {
  pawn: 'p',
  knight: 'n',
  bishop: 'b',
  rook: 'r',
  queen: 'q',
  king: 'k',
}

export function fileLetter(file: number) {
  return String.fromCharCode(97 + file)
}

export function algebraic(s: Square) {
  return `${fileLetter(s.file)}${8 - s.rank}`
}

export function fromAlgebraic(s: string) {
  return { file: s.charCodeAt(0) - 97, rank: 8 - Number(s[1]) }
}

export function sanLetter(type: PieceType) {
  return SAN_LETTER[type]
}

export function buildSanCore(
  game: Game,
  piece: Piece,
  from: Square,
  to: Square,
  isCapture: boolean,
  castleSide: 'kingside' | 'queenside' | null,
  promotion?: PieceType,
) {
  if (castleSide === 'kingside') return 'O-O'
  if (castleSide === 'queenside') return 'O-O-O'

  let san = ''

  if (piece.type === 'pawn') {
    if (isCapture) san += `${fileLetter(from.file)}x`
  } else {
    san += SAN_LETTER[piece.type]

    const ambiguous: Square[] = []
    for (const [square, other] of game.board.pieces()) {
      if (other === piece || other.type !== piece.type || other.color !== piece.color) continue
      if (game.legalMovesFrom(square).some((m) => sameSquare(m, to))) ambiguous.push(square)
    }
    if (ambiguous.length > 0) {
      const sameFile = ambiguous.some((s) => s.file === from.file)
      const sameRank = ambiguous.some((s) => s.rank === from.rank)
      if (!sameFile) san += fileLetter(from.file)
      else if (!sameRank) san += String(8 - from.rank)
      else san += algebraic(from)
    }

    if (isCapture) san += 'x'
  }

  san += algebraic(to)
  if (promotion) san += `=${SAN_LETTER[promotion]}`
  return san
}

function castlingRights(board: Board) {
  const isUnmoved = (square: Square, type: PieceType) => {
    const piece = board.get(square)
    return piece != null && piece.type === type && !piece.hasMoved
  }

  let rights = ''
  if (isUnmoved({ file: 4, rank: 7 }, 'king')) {
    if (isUnmoved({ file: 7, rank: 7 }, 'rook')) rights += 'K'
    if (isUnmoved({ file: 0, rank: 7 }, 'rook')) rights += 'Q'
  }
  if (isUnmoved({ file: 4, rank: 0 }, 'king')) {
    if (isUnmoved({ file: 7, rank: 0 }, 'rook')) rights += 'k'
    if (isUnmoved({ file: 0, rank: 0 }, 'rook')) rights += 'q'
  }
  return rights || '-'
}

export function toFEN(game: Game) {
  const rows: string[] = []
  for (let rank = 0; rank < 8; rank++) {
    let row = ''
    let empty = 0
    for (let file = 0; file < 8; file++) {
      const piece = game.board.get({ file, rank })
      if (piece == null) {
        empty++
        continue
      }
      if (empty > 0) {
        row += empty
        empty = 0
      }
      const letter = FEN_LETTER[piece.type]
      row += piece.color === 'white' ? letter.toUpperCase() : letter
    }
    if (empty > 0) row += empty
    rows.push(row)
  }

  const turn = game.turn === 'white' ? 'w' : 'b'
  const ep = game.enPassantTarget ? algebraic(game.enPassantTarget) : '-'
  const fullmove = Math.floor(game.history.length / 2) + 1

  return `${rows.join('/')} ${turn} ${castlingRights(game.board)} ${ep} ${game.halfmoveClock} ${fullmove}`
}

export function toPGN(game: Game) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  let outcome = '*'
  if (game.result?.outcome === 'checkmate') outcome = game.result.loser === 'white' ? '0-1' : '1-0'
  else if (game.result?.outcome === 'stalemate') outcome = '1/2-1/2'

  const headers = [
    '[Event "Casual Game"]',
    '[Site "Chess"]',
    `[Date "${date}"]`,
    '[Round "1"]',
    '[White "White"]',
    '[Black "Black"]',
    `[Result "${outcome}"]`,
  ]

  const pairs: string[] = []
  for (let i = 0; i < game.history.length; i += 2) {
    const num = i / 2 + 1
    const white = game.history[i].san
    const black = game.history[i + 1]?.san
    pairs.push(black != null ? `${num}. ${white} ${black}` : `${num}. ${white}`)
  }

  const movetext = [...pairs, outcome].join(' ')
  return `${headers.join('\n')}\n\n${movetext}`
}
