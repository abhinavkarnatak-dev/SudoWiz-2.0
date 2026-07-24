# Sudowiz

A Sudoku solver that runs entirely in the browser. Type a puzzle in, hit Solve,
and a backtracking search fills the rest in under a millisecond. No accounts, no
uploads, no server.

Rebuild of the original SudoWiz (Vite + JavaScript) on Next.js 16, React 19,
TypeScript and Tailwind v4.

## Getting started

```bash
npm install
cp .env.example .env.local   # paste a Gemini API key for photo scanning
npm run dev                  # http://localhost:3000
```

Solving works with no key. Only the photo scan needs one; without it that button
returns a clear "not set up" message instead of failing oddly.

| Script              | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Dev server                                |
| `npm run build`     | Production build                          |
| `npm start`         | Serve the production build                |
| `npm test`          | Run the solver and validation test suites |
| `npm run typecheck` | `tsc --noEmit`                            |
| `npm run lint`      | ESLint                                    |

To open it on a phone on the same network:

```bash
npm run dev -- -H 0.0.0.0
```

The LAN address also has to be listed in `allowedDevOrigins` in
`next.config.ts`. Next blocks cross-origin requests to `/_next` dev assets, and
without that entry the phone gets server-rendered HTML that never hydrates: the
page looks completely normal and nothing responds to taps.

## If your changes do not show up

`localhost:3000` is a shared origin across every project on this machine. A PWA
served on that port earlier leaves a **service worker registered against the
origin**, and it keeps answering requests from its own cache long after that
project is gone. The symptom is nasty: the dev server logs a fresh response, the
browser runs an old bundle, React reports a hydration mismatch, and edits appear
to do nothing no matter how many times you delete `.next` or rebuild.

Tell-tale sign: repeated `GET /sw.js` in the dev server log for a project that
has no service worker.

`public/sw.js` is a kill switch for exactly this. It deletes every cache,
unregisters itself and reloads open tabs. To force it immediately, open DevTools
→ Application → Storage → **Clear site data**.

Unrelated but same symptom: do not run `next build` while `next dev` is running.
Both write to `.next/` and the dev cache ends up serving stale chunks.

## How it works

```
src/
  lib/            pure domain logic, no React
    solver.ts       backtracking search
    validation.ts   row / column / box conflict detection
    grid.ts         board construction, parsing, counting
    puzzles.ts      sample puzzles
    scan.ts         scan prompt, schema and response parsing
    image.ts        client-side image normalisation
    types.ts        Grid, CellValue, SolveResult
    __tests__/      vitest suites for the above
  hooks/
    useSudoku.ts    reducer holding the whole board state
  app/api/scan/     photo -> grid, server side so the API key stays there
  components/
    Board.tsx       9x9 layout and focus management
    Cell.tsx        one square, memoised
    NumberPad.tsx   touch entry
    Controls.tsx    solve / undo / reset
    ...
```

Everything under `lib/` is pure and has no import from React, so the solver can
be tested, benchmarked or reused on its own.

### The solver

Same shape as the original: walk the board, try a digit, recurse, undo on
failure. Two things changed, both to stop it hanging the tab:

- **Bitmask candidates.** Each row, column and box carries a 9-bit mask of the
  digits it already holds, so checking a placement is one AND instead of 27
  array reads.
- **Fewest candidates first.** The original always filled the first empty cell
  in row-major order. That is the ordering pathological puzzles are built to
  defeat - the classic
  `000000010400000000020000000000050407008000300001090000300400200050100000000806000`
  takes a naive solver billions of steps. Picking the most constrained cell
  instead solves it in a few thousand. It ships as the **Evil** sample and the
  test suite asserts the step count stays under 200k.

`solveSudoku` returns a discriminated union rather than a boolean, so the UI can
tell apart:

| Status       | Meaning                                        |
| ------------ | ---------------------------------------------- |
| `solved`     | Filled in, with a `unique` flag and step count  |
| `invalid`    | The givens already break a rule, plus the cells |
| `unsolvable` | Legal input, but no completion exists           |
| `exhausted`  | Search budget spent (unreachable in practice)   |

It never mutates the grid it is handed.

### Photo scanning

`POST /api/scan` takes an image and returns the 81 cells. The browser never sees
the API key. The client normalises the image, the route calls Gemini
(`gemini-3.5-flash-lite`) with a constrained JSON schema, and the parsed grid
loads onto the board as editable givens for the user to check before solving.

Two findings from `scripts/scan-eval.mjs` drive the whole design, and both are
easy to undo by accident:

**Ask for a fixed 9x9 integer matrix, and nothing else.** Requesting nine
9-character strings, or a list of `{row, col, digit}` coordinates, both produced
consistent column-shift errors: the model miscounts a run of blanks and slides
the rest of the row over. A matrix with `minItems`/`maxItems` of 9 at both levels
gives structured decoding one slot per cell and took the same image from 0/3 to
3/3 exact. Adding a single extra `unreadable` field to that schema dropped it
back to 1/3, so misreads are caught by the board's own duplicate detection
instead, which is free and needs no cooperation from the model.

**Feed it enough pixels.** The same grid scored 0/3 at 580px and 3/3 at 1256px.
Bicubically enlarging the 580px original to 1400px also scored 3/3, so the model
needs pixels to resolve cell boundaries whether or not they carry new detail.
`normaliseImage` therefore scales small uploads *up* as well as large ones down.

A scan takes about 5 seconds. Failures are typed (`no-grid`, `unreadable`,
`too-large`, `not-configured`, `upstream`) so each one gets a message that says
what to do next.

### State

One `useReducer` in `useSudoku` owns the board, the origin of every cell
(user-entered vs solver-filled), the undo stack and the current message.
Conflicts and digit counts are derived with `useMemo` keyed on the board, so
moving the selection does not recompute them.

Writing a cell copies only the row it touched, and `Cell` is memoised on
primitive props with stable callbacks, so a keystroke re-renders the few cells
whose highlight actually changed rather than all 81.

## Differences from the original

- Invalid entries are accepted and highlighted in place instead of being
  rejected by a blocking `alert()`. You can see both halves of a clash, and
  Solve explains what is wrong rather than silently refusing.
- The board is a grid of buttons, not 81 text inputs. Digits come from the
  keyboard or the on-screen pad, which is what makes it workable on a phone.
- Added: photo scanning, sample puzzles, undo, digit counts, uniqueness
  detection, solve timing, and a staggered reveal animation.
- The original carried unused `tesseract.js` and `opencv.js` dependencies, an
  abandoned run at reading grids from images. `/api/scan` is that idea finished.

## Testing

```bash
npm test
```

81 tests over the solver, the validators, the grid helpers and the scan parser,
including a 200-puzzle randomised sweep and a pass that removes each of the 81
cells from a completed board in turn.

The scan's *accuracy* is not unit-testable, since it depends on a live model.
`scripts/scan-eval.mjs` covers that instead:

```bash
node --env-file=.env.local scripts/scan-eval.mjs grid.png <81-char expected> 3
```
