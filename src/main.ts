import './style.css'
import type { Color } from './chess/types.ts'
import { Game } from './chess/game.ts'
import { toFEN } from './chess/notation.ts'
import { StockfishEngine } from './engine/stockfish-engine.ts'
import { BoardView } from './ui/board-view.ts'
import { el } from './ui/dom.ts'
import { HistoryPanel } from './ui/history-panel.ts'

const BOT_COLOR: Color = 'black'
const BOT_MOVETIME_MS = 700

const boardFrame = el('board-frame')
const game = new Game()
const engine = new StockfishEngine()

const turnTextEl = el('turnText')
const turnDotEl = el('turnDot')
const gameOverOverlayEl = el('gameOverOverlay')
const gameOverTextEl = el('gameOverText')
const moveListEl = el('moveList')
const exportPgnBtn = el<HTMLButtonElement>('exportPgnBtn')
const exportFenBtn = el<HTMLButtonElement>('exportFenBtn')
const botToggleBtn = el<HTMLButtonElement>('botToggleBtn')

const boardView = new BoardView(boardFrame, game, updateStatus)
const historyPanel = new HistoryPanel(game, moveListEl, exportPgnBtn, exportFenBtn)

let botEnabled = true

function updateStatus() {
  const botThinking = botEnabled && game.result == null && game.turn === BOT_COLOR
  if (game.result != null) {
    const text = game.result.outcome === 'checkmate' ? `${game.result.loser === 'white' ? 'Black' : 'White'} wins` : 'Stalemate'
    turnTextEl.textContent = text
    gameOverTextEl.textContent = text
    gameOverOverlayEl.hidden = false
  } else {
    turnTextEl.textContent = botThinking ? 'Bot is thinking...' : game.turn === 'white' ? "White's turn" : "Black's turn"
    turnDotEl.classList.toggle('black', game.turn === 'black')
    gameOverOverlayEl.hidden = true
  }
  historyPanel.render()
  if (botThinking) runBotMove()
}

function runBotMove() {
  boardView.externalLock = true
  engine.findMove(toFEN(game), BOT_MOVETIME_MS).then(({ from, to, promotion }) => {
    boardView.externalLock = false
    boardView.playEngineMove(from, to, promotion)
  })
}

function newGame() {
  game.reset()
  boardView.reset()
  updateStatus()
}

function toggleBot() {
  botEnabled = !botEnabled
  botToggleBtn.classList.toggle('btn-primary', botEnabled)
  botToggleBtn.textContent = botEnabled ? 'Bot: On' : 'Bot: Off'
  updateStatus()
}

el('rematchBtn').addEventListener('click', newGame)
el('newGameBtn').addEventListener('click', newGame)
botToggleBtn.addEventListener('click', toggleBot)

botToggleBtn.classList.toggle('btn-primary', botEnabled)
botToggleBtn.textContent = botEnabled ? 'Bot: On' : 'Bot: Off'
updateStatus()
