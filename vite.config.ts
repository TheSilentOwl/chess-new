import { defineConfig } from 'vite'

// Stockfish's WASM build uses shared memory (SharedArrayBuffer), which requires
// the page to be cross-origin isolated. Any deploy target must send these same
// headers, or the engine worker will fail to load.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  server: { headers: crossOriginIsolationHeaders },
  preview: { headers: crossOriginIsolationHeaders },
})
