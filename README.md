# SudoWiz 2.0

A fast, responsive Sudoku solver built with Next.js, React, and TypeScript.
Enter a puzzle with the keyboard or touch controls, load a sample, or scan a
photo. SudoWiz validates the board, solves it in the browser, and reports
whether the solution is unique.

This is a ground-up rebuild of the original Vite and JavaScript version of
SudoWiz.

## Highlights

- Fast backtracking solver with candidate bitmasks and most-constrained-cell
  ordering
- Clear handling for invalid, unsolvable, non-unique, and search-limited
  puzzles
- Conflict highlighting for rows, columns, and 3-by-3 boxes
- Photo and screenshot scanning with crop, paste, drag-and-drop, and mobile
  camera support
- Sample puzzles, undo history, reset controls, digit counts, solve timing,
  and an animated solution reveal
- Keyboard navigation and a touch-friendly number pad
- Responsive board and controls for phones, tablets, and desktops
- Pure, typed domain logic covered by Vitest

## Tech stack

- Next.js 16
- React 19
- TypeScript 5
- Tailwind CSS 4
- Google Gemini for optional photo scanning
- Vitest 4

## Getting started

### Prerequisites

- Node.js 20.19 or newer
- npm

### Install and run

```bash
git clone https://github.com/abhinavkarnatak-dev/SudoWiz-2.0.git
cd SudoWiz-2.0
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The solver, sample
puzzles, and manual entry work without any external service or API key.

### Enable photo scanning

Copy the example environment file and add a Gemini API key:

```bash
cp .env.example .env.local
```

```dotenv
GEMINI_API_KEY=your_api_key_here
```

Create a key in [Google AI Studio](https://aistudio.google.com/apikey), then
restart the development server. The key is read only by the server-side scan
route and is never sent to the browser.

## Using SudoWiz

1. Enter a puzzle, choose a sample, or scan an image.
2. Review the givens. Any duplicate digits are highlighted immediately.
3. Select **Solve** or press `Enter`.
4. Use **Keep editing** to remove solver-filled cells while preserving the
   original givens.

Desktop keyboard controls:

| Keys | Action |
| --- | --- |
| `1` to `9` | Enter or toggle a digit |
| `Backspace`, `Delete`, or `0` | Clear the selected cell |
| Arrow keys | Move the selection |
| `Enter` | Solve or return to editing |
| `Escape` | Deselect the current cell |
| `Ctrl+Z` or `Cmd+Z` | Undo |

## Photo scanning and privacy

Photo scanning is optional. The browser crops and normalizes the selected
image, then sends it to `POST /api/scan`. The server forwards the image to the
configured Gemini model and returns a validated 9-by-9 grid. The Gemini API key
remains on the server.

Manual puzzle entry and solving stay entirely in the browser. Images are sent
to the application server and Google only when the user chooses to scan one.
Review Google's data handling terms before enabling this feature in a public
deployment.

The scan endpoint currently enforces an 8 MB upload limit and a 30-second
upstream timeout. Public deployments should also add rate limiting and any
authentication or usage controls appropriate for their audience.

## How the solver works

The solver uses recursive backtracking with two optimizations:

- Candidate bitmasks track the digits already used in every row, column, and
  box.
- Most-constrained-cell ordering fills the empty cell with the fewest legal
  candidates first.

This keeps difficult puzzles practical without changing the underlying Sudoku
rules. The solver does not mutate its input and returns a typed result:

| Status | Meaning |
| --- | --- |
| `solved` | A solution was found, with uniqueness and step-count metadata |
| `invalid` | The given digits already conflict |
| `unsolvable` | The givens are valid, but no completion exists |
| `exhausted` | The solver reached its search budget |

## Project structure

```text
src/
  app/
    api/scan/        Server-side image-to-grid endpoint
    globals.css      Theme and global styles
    layout.tsx       App metadata and root layout
    page.tsx         Application entry point
  components/        Board, controls, cropper, status, and navigation UI
  hooks/
    useScan.ts       Scan request lifecycle
    useSudoku.ts     Board reducer, history, messages, and solve state
  lib/
    __tests__/       Solver, validation, grid, and scan parser tests
    grid.ts          Grid creation, parsing, and counting helpers
    image.ts         Client-side image normalization
    puzzles.ts       Built-in sample puzzles
    scan.ts          Scan schema, prompts, errors, and response parsing
    solver.ts        Backtracking solver
    validation.ts    Row, column, and box conflict detection
scripts/
  scan-eval.mjs      Live scan accuracy evaluator
```

The code under `src/lib` is independent of React, which keeps the domain logic
straightforward to test, benchmark, and reuse.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## Testing

Run the complete local verification suite:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The automated tests cover the solver, conflict validation, grid helpers, scan
response parsing, randomized puzzles, and the difficult built-in sample.

Model accuracy depends on the live scan service and image quality, so it is
evaluated separately:

```bash
node --env-file=.env.local scripts/scan-eval.mjs grid.png <81-character-grid> 3
```

Use `0` for blank cells in the expected 81-character grid. The last argument is
the number of scan attempts.

## Test on another device

To open the development server from a phone or tablet on the same network:

```bash
npm run dev -- -H 0.0.0.0
```

Add the development machine's LAN address to `allowedDevOrigins` in
`next.config.ts`. Next.js otherwise blocks cross-origin requests for its
development assets, leaving the page visible but not interactive.

## Troubleshooting stale local builds

Another app previously served from `localhost:3000` may have registered a
service worker that still returns cached assets. Common symptoms include stale
UI, hydration warnings, or repeated requests to `/sw.js`.

`public/sw.js` is a cleanup worker that removes old caches, unregisters itself,
and reloads open tabs. To clear the origin manually, open the browser developer
tools, go to **Application**, then **Storage**, and choose **Clear site data**.

Also avoid running `next build` while `next dev` is active because both
processes write to `.next`.

## Contributing

Bug reports and focused pull requests are welcome. Before opening a pull
request, run the lint, typecheck, test, and build commands listed above.
