---
description: Pre-release verification checklist for stream-chain
---

# Release Check

Run through this checklist before publishing a new version.

## Steps

1. Check that every public `.js` file in `src/` has a corresponding `.d.ts` file.
2. Check that `src/index.js` and `src/index.d.ts` are in sync (all exports, all types).
3. Check that `ARCHITECTURE.md` reflects any structural changes.
4. Check that `AGENTS.md` is up to date with any rule or workflow changes.
5. Check that `.windsurfrules`, `.clinerules`, `.cursorrules` are in sync with `AGENTS.md`.
6. Check that `wiki/Home.md` links to all relevant wiki pages.
7. Check that `llms.txt` and `llms-full.txt` are up to date with any API changes.
8. Verify `package.json`:
   - `files` array includes all necessary entries (`src`, `LICENSE`, `README.md`).
   - `exports` map is correct.
9. Check that the copyright year in `LICENSE` includes the current year (e.g., update `2024` → `2024-2026` or `2005-2024` → `2005-2026`).
10. Bump `version` in `package.json`.
11. Update release history in `README.md`.
12. Run `npm install` to regenerate `package-lock.json`.
    // turbo
13. Run the full test suite with Node: `npm test`
    // turbo
14. Run tests with Bun: `npm run test:bun`
    // turbo
15. Run tests with Deno: `npm run test:deno`
    // turbo
16. Run TypeScript check: `npm run ts-check`
    // turbo
17. Run lint: `npm run lint`
    // turbo
18. Dry-run publish to verify package contents: `npm pack --dry-run`
