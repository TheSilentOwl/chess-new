import type { Game } from '../chess/game.ts'
import { isEnPassantCapture } from '../chess/moves.ts'
import type { Color, PieceType, Square } from '../chess/types.ts'
import { sameSquare, squareKey } from '../chess/types.ts'
import { pieceImageSrc } from './piece-images.ts'
import { sounds } from './sounds.ts'

const PROMO_CHOICES: PieceType[] = ['queen', 'rook', 'bishop', 'knight']
const SQUARE_PERCENT = 100 / 8
const DRAG_THRESHOLD_PX = 4
const ARROWHEAD_STROKE_WIDTH = 0.16
const ARROWHEAD_MARKER_SIZE = 2.8
const ARROWHEAD_REACH = ARROWHEAD_STROKE_WIDTH * ARROWHEAD_MARKER_SIZE

interface PieceEl {
  el: HTMLDivElement
  img: HTMLImageElement
}

export class BoardView {
  readonly rootEl: HTMLElement

  private squareEls: HTMLElement[][] = []
  private pieceLayer: HTMLElement
  private pieceEls = new Map<number, PieceEl>()
  private pieceSquares = new Map<number, Square>()
  private promoEl: HTMLElement
  private promoButtons: HTMLButtonElement[] = []

  externalLock = false

  private selectedSquare: Square | null = null
  private legalMoves: Square[] = []
  private dragPieceId: number | null = null
  private dragEntry: PieceEl | null = null
  private dragHoverEl: HTMLElement | null = null
  private game: Game
  private onChange: () => void

  private annotationLayer: SVGSVGElement
  private arrows: { from: Square; to: Square }[] = []
  private circles: Square[] = []
  private rightDragStart: Square | null = null
  private rightDragCurrent: Square | null = null

  constructor(container: HTMLElement, game: Game, onChange: () => void) {
    this.game = game
    this.onChange = onChange
    this.rootEl = document.createElement('div')
    this.rootEl.className = 'board'
    container.prepend(this.rootEl)

    for (let rank = 0; rank < 8; rank++) {
      const row: HTMLElement[] = []
      for (let file = 0; file < 8; file++) row.push(this.buildSquare(file, rank))
      this.squareEls.push(row)
    }

    this.pieceLayer = document.createElement('div')
    this.pieceLayer.className = 'piece-layer'
    this.rootEl.appendChild(this.pieceLayer)

    this.annotationLayer = this.buildAnnotationLayer()
    this.rootEl.appendChild(this.annotationLayer)

    const picker = this.buildPromoPicker()
    this.promoEl = picker.el
    this.promoButtons = picker.buttons
    container.appendChild(this.promoEl)

    this.rootEl.addEventListener('contextmenu', (e) => e.preventDefault())
    this.rootEl.addEventListener('pointerdown', (e) => this.handleBoardPointerDown(e))

    this.render()
  }

  reset() {
    this.deselect()
    this.dragPieceId = null
    this.arrows = []
    this.circles = []
    this.renderAnnotations()
    this.render()
  }

  render() {
    const board = this.game.board

    const checkedKingSquares = new Set<string>()
    for (const color of ['white', 'black'] as Color[]) {
      if (!this.game.isInCheck(color)) continue
      const kingSquare = board.findKing(color)
      if (kingSquare != null) checkedKingSquares.add(squareKey(kingSquare))
    }
    const legalMoveKeys = new Set(this.legalMoves.map(squareKey))
    const selectedPiece = this.selectedSquare != null ? board.get(this.selectedSquare) : null

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = { file, rank }
        const key = squareKey(square)
        const el = this.squareEls[rank][file]
        const isLegal = legalMoveKeys.has(key)
        const occupied = board.get(square) != null
        const isEnPassant =
          !occupied && selectedPiece != null && isEnPassantCapture(board, selectedPiece, this.selectedSquare!, square)
        el.classList.toggle('selected', this.selectedSquare != null && sameSquare(this.selectedSquare, square))
        el.classList.toggle('legal-move', isLegal && !occupied && !isEnPassant)
        el.classList.toggle('legal-capture', isLegal && occupied)
        el.classList.toggle('legal-ep', isLegal && isEnPassant)
        el.classList.toggle('in-check', checkedKingSquares.has(key))
      }
    }

    this.pieceSquares.clear()
    const seenIds = new Set<number>()
    for (const [square, piece] of board.pieces()) {
      seenIds.add(piece.id)
      this.pieceSquares.set(piece.id, square)

      let entry = this.pieceEls.get(piece.id)
      if (entry == null) entry = this.buildPieceEl(piece.id, square)

      entry.img.src = pieceImageSrc(piece.color, piece.type)
      entry.img.alt = `${piece.color} ${piece.type}`
      entry.el.classList.toggle('draggable', this.game.result == null && piece.color === this.game.turn)
      if (piece.id !== this.dragPieceId) this.positionPiece(entry.el, square)
    }

    for (const [id, entry] of this.pieceEls) {
      if (seenIds.has(id)) continue
      entry.el.classList.add('captured')
      entry.el.addEventListener('transitionend', () => entry.el.remove(), { once: true })
      this.pieceEls.delete(id)
    }

    if (this.game.pendingPromotion != null) {
      const { color } = this.game.pendingPromotion
      this.promoButtons.forEach((btn, i) => {
        const img = btn.querySelector('img')!
        img.src = pieceImageSrc(color, PROMO_CHOICES[i])
        img.alt = PROMO_CHOICES[i]
      })
      this.promoEl.hidden = false
    } else {
      this.promoEl.hidden = true
    }
  }

  private buildSquare(file: number, rank: number) {
    const el = document.createElement('div')
    el.className = `square ${(file + rank) % 2 === 0 ? 'tile-light' : 'tile-dark'}`
    el.addEventListener('click', () => this.tryMoveOrSelect({ file, rank }))
    this.rootEl.appendChild(el)
    return el
  }

  private buildPromoPicker() {
    const el = document.createElement('div')
    el.className = 'overlay promo-picker'
    el.hidden = true

    const buttons = PROMO_CHOICES.map((type) => {
      const btn = document.createElement('button')
      btn.className = 'promo-choice'
      btn.type = 'button'
      btn.addEventListener('click', () => {
        this.game.resolvePromotion(type)
        this.afterMove()
      })
      btn.appendChild(document.createElement('img'))
      el.appendChild(btn)
      return btn
    })

    return { el, buttons }
  }

  private buildPieceEl(pieceId: number, square: Square) {
    const el = document.createElement('div')
    el.className = 'piece entering'
    el.addEventListener('animationend', () => el.classList.remove('entering'), { once: true })
    el.addEventListener('pointerdown', (e) => this.handlePointerDown(e, pieceId))
    this.positionPiece(el, square)

    const img = document.createElement('img')
    img.draggable = false
    el.appendChild(img)

    this.pieceLayer.appendChild(el)
    const entry: PieceEl = { el, img }
    this.pieceEls.set(pieceId, entry)
    return entry
  }

  private positionPiece(el: HTMLElement, square: Square) {
    el.style.left = `${square.file * SQUARE_PERCENT}%`
    el.style.top = `${square.rank * SQUARE_PERCENT}%`
  }

  private squareAtPoint(clientX: number, clientY: number) {
    const rect = this.rootEl.getBoundingClientRect()
    const file = Math.floor(((clientX - rect.left) / rect.width) * 8)
    const rank = Math.floor(((clientY - rect.top) / rect.height) * 8)
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
    return { file, rank }
  }

  private get inputLocked() {
    return this.game.result != null || this.game.pendingPromotion != null || this.externalLock
  }

  private isLegalTarget(square: Square) {
    return this.legalMoves.some((m) => sameSquare(m, square))
  }

  private deselect() {
    this.selectedSquare = null
    this.legalMoves = []
  }

  private afterMove() {
    this.deselect()
    this.render()
    this.onChange()
    if (this.game.result != null) sounds.gameover()
  }

  private playMoveSound(from: Square, to: Square) {
    const piece = this.game.board.get(from)
    const isCapture = piece != null && (this.game.board.get(to) != null || isEnPassantCapture(this.game.board, piece, from, to))
    if (isCapture) sounds.capture()
    else sounds.move()
  }

  playEngineMove(from: Square, to: Square, promotion?: PieceType) {
    this.playMoveSound(from, to)
    this.game.makeMove(from, to, promotion)
    this.afterMove()
  }

  private tryMoveOrSelect(square: Square) {
    if (this.inputLocked) return

    if (this.selectedSquare != null && this.isLegalTarget(square)) {
      this.playMoveSound(this.selectedSquare, square)
      this.game.makeMove(this.selectedSquare, square)
      this.afterMove()
      return
    }

    const piece = this.game.board.get(square)
    if (piece != null && piece.color === this.game.turn) {
      this.selectedSquare = square
      this.legalMoves = this.game.legalMovesFrom(square)
    } else {
      this.deselect()
    }
    this.render()
  }

  private handlePointerDown(e: PointerEvent, pieceId: number) {
    if (e.button !== 0) return
    if (this.inputLocked) return
    const from = this.pieceSquares.get(pieceId)
    if (from == null) return

    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const piece = this.game.board.get(from)
    const canDrag = piece != null && piece.color === this.game.turn
    let dragging = false

    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        if (!canDrag) return
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return
        dragging = true
        this.beginDrag(pieceId, from)
      }
      this.updateDrag(ev)
    }

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      document.removeEventListener('contextmenu', onContextMenu)
      if (dragging) this.endDrag(ev)
      else this.tryMoveOrSelect(from)
    }

    const onContextMenu = (ev: MouseEvent) => {
      if (!dragging) return
      ev.preventDefault()
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      document.removeEventListener('contextmenu', onContextMenu)
      this.cancelDrag()
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    document.addEventListener('contextmenu', onContextMenu)
  }

  private beginDrag(pieceId: number, from: Square) {
    const entry = this.pieceEls.get(pieceId)
    if (entry == null) return
    this.dragPieceId = pieceId
    this.dragEntry = entry
    this.selectedSquare = from
    this.legalMoves = this.game.legalMovesFrom(from)
    entry.el.classList.add('dragging')
    this.render()
  }

  private updateDrag(ev: PointerEvent) {
    if (this.dragEntry == null) return
    const rect = this.rootEl.getBoundingClientRect()
    const half = SQUARE_PERCENT / 2
    const leftPct = ((ev.clientX - rect.left) / rect.width) * 100 - half
    const topPct = ((ev.clientY - rect.top) / rect.height) * 100 - half
    this.dragEntry.el.style.left = `${leftPct}%`
    this.dragEntry.el.style.top = `${topPct}%`
    this.updateDragHover(this.squareAtPoint(ev.clientX, ev.clientY))
  }

  private updateDragHover(square: Square | null) {
    const el = square != null && this.isLegalTarget(square) ? this.squareEls[square.rank][square.file] : null
    if (el === this.dragHoverEl) return
    this.dragHoverEl?.classList.remove('drag-hover')
    el?.classList.add('drag-hover')
    this.dragHoverEl = el
  }

  private cancelDrag() {
    this.dragEntry?.el.classList.remove('dragging')
    this.dragPieceId = null
    this.dragEntry = null
    this.updateDragHover(null)
    this.deselect()
    this.render()
  }

  private endDrag(ev: PointerEvent) {
    const from = this.selectedSquare!
    this.dragEntry?.el.classList.remove('dragging')
    this.dragPieceId = null
    this.dragEntry = null
    this.updateDragHover(null)

    const target = this.squareAtPoint(ev.clientX, ev.clientY)
    if (target != null && this.isLegalTarget(target)) {
      this.playMoveSound(from, target)
      this.game.makeMove(from, target)
      this.afterMove()
    } else {
      this.deselect()
      this.render()
    }
  }

  private buildAnnotationLayer() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'annotation-layer')
    svg.setAttribute('viewBox', '0 0 8 8')
    svg.setAttribute('preserveAspectRatio', 'none')

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker')
    marker.setAttribute('id', 'annotation-arrowhead')
    marker.setAttribute('viewBox', '0 0 10 10')
    marker.setAttribute('refX', '0')
    marker.setAttribute('refY', '5')
    marker.setAttribute('markerWidth', `${ARROWHEAD_MARKER_SIZE}`)
    marker.setAttribute('markerHeight', `${ARROWHEAD_MARKER_SIZE}`)
    marker.setAttribute('orient', 'auto-start-reverse')
    const arrowheadPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    arrowheadPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z')
    arrowheadPath.setAttribute('fill', 'var(--annotation)')
    marker.appendChild(arrowheadPath)
    defs.appendChild(marker)
    svg.appendChild(defs)

    return svg
  }

  private handleBoardPointerDown(e: PointerEvent) {
    if (e.button === 2) {
      if (this.dragPieceId == null) this.startAnnotationDrag(e)
    } else if (e.button === 0) {
      this.clearAnnotations()
    }
  }

  private startAnnotationDrag(e: PointerEvent) {
    const start = this.squareAtPoint(e.clientX, e.clientY)
    if (start == null) return
    e.preventDefault()
    this.rightDragStart = start
    this.rightDragCurrent = start
    this.renderAnnotations()

    const onMove = (ev: PointerEvent) => {
      const square = this.squareAtPoint(ev.clientX, ev.clientY)
      if (square != null) this.rightDragCurrent = square
      this.renderAnnotations()
    }

    const finish = (endSquare: Square | null) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      const from = this.rightDragStart!
      const to = endSquare ?? this.rightDragCurrent!
      this.rightDragStart = null
      this.rightDragCurrent = null
      if (sameSquare(from, to)) this.toggleCircle(from)
      else this.toggleArrow(from, to)
      this.renderAnnotations()
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.button !== 2) return
      finish(this.squareAtPoint(ev.clientX, ev.clientY))
    }

    const onCancel = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      this.rightDragStart = null
      this.rightDragCurrent = null
      this.renderAnnotations()
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
  }

  private toggleArrow(from: Square, to: Square) {
    const idx = this.arrows.findIndex((a) => sameSquare(a.from, from) && sameSquare(a.to, to))
    if (idx >= 0) this.arrows.splice(idx, 1)
    else this.arrows.push({ from, to })
  }

  private toggleCircle(square: Square) {
    const idx = this.circles.findIndex((s) => sameSquare(s, square))
    if (idx >= 0) this.circles.splice(idx, 1)
    else this.circles.push(square)
  }

  private clearAnnotations() {
    if (this.arrows.length === 0 && this.circles.length === 0) return
    this.arrows = []
    this.circles = []
    this.renderAnnotations()
  }

  private renderAnnotations() {
    for (const child of [...this.annotationLayer.children]) {
      if (child.tagName !== 'defs') child.remove()
    }

    for (const square of this.circles) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('class', 'annotation-circle')
      circle.setAttribute('cx', `${square.file + 0.5}`)
      circle.setAttribute('cy', `${square.rank + 0.5}`)
      circle.setAttribute('r', '0.42')
      this.annotationLayer.appendChild(circle)
    }

    for (const arrow of this.arrows) this.annotationLayer.appendChild(this.buildArrowEl(arrow.from, arrow.to))

    if (this.rightDragStart != null && this.rightDragCurrent != null) {
      if (sameSquare(this.rightDragStart, this.rightDragCurrent)) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('class', 'annotation-circle annotation-preview')
        circle.setAttribute('cx', `${this.rightDragStart.file + 0.5}`)
        circle.setAttribute('cy', `${this.rightDragStart.rank + 0.5}`)
        circle.setAttribute('r', '0.42')
        this.annotationLayer.appendChild(circle)
      } else {
        const arrowEl = this.buildArrowEl(this.rightDragStart, this.rightDragCurrent)
        arrowEl.classList.add('annotation-preview')
        this.annotationLayer.appendChild(arrowEl)
      }
    }
  }

  private buildArrowEl(from: Square, to: Square) {
    const x1 = from.file + 0.5
    const y1 = from.rank + 0.5
    const x2 = to.file + 0.5
    const y2 = to.rank + 0.5
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.hypot(dx, dy)
    const shorten = Math.min(ARROWHEAD_REACH, length)
    const ex = length === 0 ? x2 : x2 - (dx / length) * shorten
    const ey = length === 0 ? y2 : y2 - (dy / length) * shorten

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('class', 'annotation-arrow')
    line.setAttribute('x1', `${x1}`)
    line.setAttribute('y1', `${y1}`)
    line.setAttribute('x2', `${ex}`)
    line.setAttribute('y2', `${ey}`)
    line.setAttribute('marker-end', 'url(#annotation-arrowhead)')
    return line
  }
}
