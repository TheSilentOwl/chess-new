# chess

A chess web app with an optional Stockfish bot opponent, built with Bun, TypeScript, and Vite.

## Requirements

- [Bun](https://bun.sh)

## Install

```
bun install
```

## Development

```
bun run dev
```

Starts the Vite dev server (default `http://localhost:5173`).

## Production build

```
bun run build
bun run preview
```

`build` type-checks (`tsc`) and produces a static build in `dist/`. `preview` serves that build locally to sanity-check it before deploying.

## Deploying

`dist/` is a static site and can be served by any static host, with one exception:
the Stockfish engine (`@lichess-org/stockfish-web`) uses shared WebAssembly memory,
which browsers only allow on a [cross-origin isolated](https://web.dev/articles/cross-origin-isolation-guide) page.
The host must send these two headers on every response (or at least on `/`, the JS bundle, and everything under `/engine/`):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

`vite.config.ts` already sends these for `bun run dev` and `bun run preview`. For an actual deployment:

- **Netlify**: add a `_headers` file to `public/` (copied into `dist/` automatically) with those two headers for `/*`.
- **Vercel**: add a `headers` entry in `vercel.json`.
- **nginx or a custom server**: add `add_header` directives for both.
- **GitHub Pages**: not supported — it doesn't allow setting custom response headers.
- **Docker**: see below — `docker compose up` builds and serves the app with these headers already set.

Without these headers the app still loads and plays chess normally; only the "Bot" toggle fails silently (the engine worker never completes its handshake).

### Docker

```
docker compose up --build
```

Serves the app at `http://localhost:8080`. This builds the static site with Bun (`Dockerfile`, stage 1) and serves it with [Caddy](https://caddyserver.com) (stage 2), which sends the COOP/COEP headers from `Caddyfile`. Change the exposed port in `docker-compose.yml` if `8080` is taken.

## Project structure

- `src/chess/` — pure chess engine: board state, move generation, check/checkmate detection, SAN/FEN/PGN notation.
- `src/ui/` — DOM rendering and input handling (click and drag-and-drop) for the board and move-history panel.
- `src/engine/` — wraps the Stockfish Web Worker (`public/engine/`) behind a small `findMove(fen)` API.
- `public/engine/` — vendored Stockfish 19 (smallnet) WASM build, its NNUE weights, and the worker script that loads them. Kept as plain static files (not run through Vite's TS/JS pipeline) since Vite's dev-time module transform breaks the worker's dynamic `import()` of same-origin assets.
