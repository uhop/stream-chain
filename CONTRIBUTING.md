# Contributing to stream-chain

Thank you for your interest in contributing!

## Getting started

This project uses a git submodule for the wiki. Clone recursively:

```bash
git clone --recursive git@github.com:uhop/stream-chain.git
cd stream-chain
npm install
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the module map and dependency graph.

## Development workflow

1. Make your changes.
2. Test: `npm test`
3. Type-check: `npm run ts-check`

## Code style

- CommonJS (`require()`/`module.exports`) in source, ESM (`import`) in tests (`.mjs`).
- Formatted with Prettier — see `.prettierrc` for settings.
- No unnecessary dependencies — the library has zero runtime dependencies.
- Keep `src/index.js` and `src/index.d.ts` in sync.
- Keep `.js` and `.d.ts` files in sync for all modules under `src/`.

## AI agents

If you are an AI coding agent, see [AGENTS.md](./AGENTS.md) for detailed project conventions, commands, and architecture.
