const move = new Audio('/assets/sounds/move.ogg')
const capture = new Audio('/assets/sounds/capture.ogg')
const gameover = new Audio('/assets/sounds/gameover.ogg')

function play(audio: HTMLAudioElement) {
  audio.currentTime = 0
  void audio.play().catch(() => {})
}

export const sounds = {
  move: () => play(move),
  capture: () => play(capture),
  gameover: () => play(gameover),
}
