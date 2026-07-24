import { CELL_COUNT, SIZE, boxIndex, createEmptyGrid } from "./grid";
import { findConflicts } from "./validation";
import type { CellRef, CellValue, Grid, SolveResult } from "./types";

/**
 * Depth-first backtracking Sudoku solver.
 *
 * This is the same algorithm the original SudoWiz used - walk the board, try
 * digits 1-9 in a cell, recurse, undo on failure - with two changes that keep
 * the behaviour identical but stop it hanging the browser:
 *
 * 1. Candidate sets are tracked as 9-bit masks per row, column and box, so a
 *    legality check is one bitwise AND instead of 27 array reads.
 * 2. The next cell to fill is the empty cell with the *fewest* candidates
 *    (minimum-remaining-values) rather than the first empty cell in row-major
 *    order. Scanning row-major is what makes naive solvers stall for minutes on
 *    puzzles engineered against them, such as
 *    `000000010400000000020000000000050407008000300001090000300400200050100000000806000`.
 *    Digits are still tried in ascending order, so the search is deterministic.
 *
 * The solver is pure: the input grid is never mutated.
 */

/** Bits 0-8 set: every digit still available. */
const FULL_MASK = 0b111111111;

/**
 * Hard ceiling on backtracking steps. With MRV even the hardest known 9x9
 * puzzles finish in well under 100k steps, so hitting this means the input is
 * pathological rather than merely hard.
 */
const MAX_STEPS = 2_000_000;

interface SearchContext {
  /** Flat row-major board, 0 for empty. */
  cells: Uint8Array;
  rowMask: Uint16Array;
  colMask: Uint16Array;
  boxMask: Uint16Array;
  /** Box index for every cell, precomputed to keep the hot loop branch-free. */
  boxOf: Uint8Array;
  steps: number;
  budgetSpent: boolean;
  solutions: Uint8Array[];
}

export interface SolveOptions {
  /**
   * Keep searching after the first solution to detect whether the puzzle is
   * ambiguous. Costs one extra search; still sub-millisecond in practice.
   * Defaults to `true`.
   */
  checkUniqueness?: boolean;
}

/**
 * Solve a puzzle.
 *
 * Returns a discriminated result rather than a boolean so callers can tell an
 * illegal starting board apart from a legal but unsolvable one.
 */
export function solveSudoku(grid: Grid, options: SolveOptions = {}): SolveResult {
  const { checkUniqueness = true } = options;

  // A board that already breaks a rule has no solution, but the useful message
  // is "these cells clash", not "no solution exists".
  const conflicts = findConflicts(grid);
  if (conflicts.length > 0) {
    return { status: "invalid", conflicts };
  }

  const ctx = createContext(grid);
  const limit = checkUniqueness ? 2 : 1;
  search(ctx, limit);

  if (ctx.budgetSpent && ctx.solutions.length === 0) {
    return { status: "exhausted", steps: ctx.steps };
  }

  if (ctx.solutions.length === 0) {
    return { status: "unsolvable", steps: ctx.steps };
  }

  const solved = toGrid(ctx.solutions[0]);
  const filled: CellRef[] = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (grid[row][col] === 0) filled.push({ row, col });
    }
  }

  return {
    status: "solved",
    grid: solved,
    filled,
    // If the budget ran out mid-second-search we cannot prove ambiguity, so
    // report the puzzle as unique rather than warning on a guess.
    unique: !checkUniqueness || ctx.solutions.length < 2,
    steps: ctx.steps,
  };
}

/**
 * Number of distinct solutions, counted up to `limit`.
 * Useful on its own for grading a puzzle as unique / ambiguous.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  if (findConflicts(grid).length > 0) return 0;
  const ctx = createContext(grid);
  search(ctx, Math.max(1, limit));
  return ctx.solutions.length;
}

/**
 * Recursive search. Returns how many solutions were recorded in this subtree,
 * stopping once `limit` have been found.
 */
function search(ctx: SearchContext, limit: number): number {
  if (ctx.budgetSpent) return 0;
  if (ctx.steps >= MAX_STEPS) {
    ctx.budgetSpent = true;
    return 0;
  }

  let bestIndex = -1;
  let bestCandidates = 0;
  let bestCount = SIZE + 1;

  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (ctx.cells[i] !== 0) continue;

    const row = (i / SIZE) | 0;
    const col = i % SIZE;
    const used = ctx.rowMask[row] | ctx.colMask[col] | ctx.boxMask[ctx.boxOf[i]];
    const candidates = FULL_MASK & ~used;

    // No legal digit for this cell: this branch is dead, no point looking further.
    if (candidates === 0) return 0;

    const count = popCount(candidates);
    if (count < bestCount) {
      bestCount = count;
      bestCandidates = candidates;
      bestIndex = i;
      // A forced cell is the best possible pick; stop scanning.
      if (count === 1) break;
    }
  }

  // No empty cell left, so the board is complete and legal by construction.
  if (bestIndex === -1) {
    ctx.solutions.push(ctx.cells.slice());
    return 1;
  }

  const row = (bestIndex / SIZE) | 0;
  const col = bestIndex % SIZE;
  const box = ctx.boxOf[bestIndex];
  let found = 0;

  // Ascending digit order, matching the original 1..9 loop.
  for (let digit = 1; digit <= SIZE; digit += 1) {
    const bit = 1 << (digit - 1);
    if ((bestCandidates & bit) === 0) continue;

    ctx.steps += 1;
    ctx.cells[bestIndex] = digit;
    ctx.rowMask[row] |= bit;
    ctx.colMask[col] |= bit;
    ctx.boxMask[box] |= bit;

    found += search(ctx, limit - found);

    ctx.cells[bestIndex] = 0;
    ctx.rowMask[row] &= ~bit;
    ctx.colMask[col] &= ~bit;
    ctx.boxMask[box] &= ~bit;

    if (found >= limit || ctx.budgetSpent) break;
  }

  return found;
}

function createContext(grid: Grid): SearchContext {
  const cells = new Uint8Array(CELL_COUNT);
  const rowMask = new Uint16Array(SIZE);
  const colMask = new Uint16Array(SIZE);
  const boxMask = new Uint16Array(SIZE);
  const boxOf = new Uint8Array(CELL_COUNT);

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const index = row * SIZE + col;
      const box = boxIndex(row, col);
      boxOf[index] = box;

      const value = grid[row][col];
      if (value === 0) continue;

      const bit = 1 << (value - 1);
      cells[index] = value;
      rowMask[row] |= bit;
      colMask[col] |= bit;
      boxMask[box] |= bit;
    }
  }

  return {
    cells,
    rowMask,
    colMask,
    boxMask,
    boxOf,
    steps: 0,
    budgetSpent: false,
    solutions: [],
  };
}

function toGrid(cells: Uint8Array): Grid {
  const grid = createEmptyGrid();
  for (let i = 0; i < CELL_COUNT; i += 1) {
    grid[(i / SIZE) | 0][i % SIZE] = cells[i] as CellValue;
  }
  return grid;
}

/** Number of set bits in a 9-bit mask. */
function popCount(mask: number): number {
  let count = 0;
  let bits = mask;
  while (bits !== 0) {
    bits &= bits - 1;
    count += 1;
  }
  return count;
}
