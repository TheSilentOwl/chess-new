import { fromAlgebraic } from '../chess/notation.ts'
import type { PieceType, Square } from '../chess/types.ts'

const PROMOTION_LETTER: Record<string, PieceType> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
}

export interface EngineMove {
  from: Square
  to: Square
  promotion?: PieceType
}

function parseUciMove(uci: string) {
  const from = fromAlgebraic(uci.slice(0, 2))
  const to = fromAlgebraic(uci.slice(2, 4))
  const promotion = uci.length > 4 ? PROMOTION_LETTER[uci[4]] : undefined
  return { from, to, promotion }
}

export class StockfishEngine {
  private worker: Worker
  private ready: Promise<void>
  private pendingMove: ((move: EngineMove) => void) | null = null

  constructor() {
    this.worker = new Worker('/engine/stockfish-worker.js', { type: 'module' })
    this.worker.addEventListener('message', (e: MessageEvent<string>) => this.handleMessage(e.data))
    this.ready = new Promise((resolve) => {
      this.readyResolve = resolve
    })
    this.worker.postMessage('uci')
  }

  private readyResolve!: () => void

  private handleMessage(line: string) {
    if (line === 'uciok') {
      this.worker.postMessage('isready')
    } else if (line === 'readyok') {
      this.readyResolve()
    } else if (line.startsWith('bestmove')) {
      const uci = line.split(' ')[1]
      this.pendingMove?.(parseUciMove(uci))
      this.pendingMove = null
    }
  }

  async findMove(fen: string, movetimeMs = 700): Promise<EngineMove> {
    await this.ready
    this.worker.postMessage(`position fen ${fen}`)
    return new Promise((resolve) => {
      this.pendingMove = resolve
      this.worker.postMessage(`go movetime ${movetimeMs}`)
    })
  }
}
