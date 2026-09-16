const ENGINE_JS_URL = '/engine/sf_19_smallnet.js'
const NNUE_URL = '/engine/nn-61e7af4bb97d.nnue'

async function loadEngine() {
  const { default: initEngine } = await import(ENGINE_JS_URL)
  const engine = await initEngine({ locateFile: (path) => `/engine/${path}` })

  const nnueRes = await fetch(NNUE_URL)
  engine.setNnueBuffer(new Uint8Array(await nnueRes.arrayBuffer()))

  engine.listen = (line) => postMessage(line)
  engine.onError = (msg) => postMessage(`error ${msg}`)
  return engine
}

const enginePromise = loadEngine()

self.onmessage = async (e) => {
  const engine = await enginePromise
  engine.uci(e.data)
}
