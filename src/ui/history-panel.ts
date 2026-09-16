import type { Game } from '../chess/game.ts'
import { toFEN, toPGN } from '../chess/notation.ts'

const FLASH_MS = 1200

function span(className: string, text: string) {
  const el = document.createElement('span')
  el.className = className
  el.textContent = text
  return el
}

export class HistoryPanel {
  private game: Game
  private listEl: HTMLElement
  private pgnBtn: HTMLButtonElement
  private fenBtn: HTMLButtonElement

  constructor(game: Game, listEl: HTMLElement, pgnBtn: HTMLButtonElement, fenBtn: HTMLButtonElement) {
    this.game = game
    this.listEl = listEl
    this.pgnBtn = pgnBtn
    this.fenBtn = fenBtn

    this.pgnBtn.addEventListener('click', () => this.copy(toPGN(this.game), this.pgnBtn))
    this.fenBtn.addEventListener('click', () => this.copy(toFEN(this.game), this.fenBtn))
  }

  render() {
    this.listEl.innerHTML = ''
    const { history } = this.game

    for (let i = 0; i < history.length; i += 2) {
      const row = document.createElement('li')
      row.className = 'move-row'
      row.append(
        span('move-number', `${i / 2 + 1}.`),
        span('move-san', history[i].san),
        span('move-san', history[i + 1]?.san ?? ''),
      )
      this.listEl.appendChild(row)
    }

    this.listEl.scrollTop = this.listEl.scrollHeight
  }

  private async copy(text: string, btn: HTMLButtonElement) {
    try {
      await navigator.clipboard.writeText(text)
      this.flash(btn, 'Copied')
    } catch {
      this.flash(btn, 'Copy failed')
    }
  }

  private flash(btn: HTMLButtonElement, message: string) {
    const original = btn.textContent
    btn.textContent = message
    btn.disabled = true
    setTimeout(() => {
      btn.textContent = original
      btn.disabled = false
    }, FLASH_MS)
  }
}
