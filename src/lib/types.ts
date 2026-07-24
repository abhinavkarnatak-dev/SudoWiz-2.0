/**
 * Shared domain types for the Sudoku board.
 *
 * The board is modelled as a 9x9 matrix of numbers where `0` means "empty".
 * Using numbers instead of strings keeps the solver arithmetic-only and makes
 * bitmask candidate tracking possible.
 */

export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** A single cell: a digit, or 0 for an empty cell. */
export type CellValue = 0 | Digit;

/** A 9x9 board. Always exactly 9 rows of 9 cells. */
export type Grid = CellValue[][];

/**
 * Where a cell's value came from.
 * - `empty`  : no value
 * - `given`  : typed in by the user
 * - `solved` : filled in by the solver
 */
export type CellOrigin = "empty" | "given" | "solved";

export type OriginGrid = CellOrigin[][];

/** Zero-based board coordinate. */
export interface CellRef {
  row: number;
  col: number;
}

export type Difficulty = "easy" | "medium" | "hard" | "evil";

export interface Puzzle {
  id: string;
  label: string;
  difficulty: Difficulty;
  /** 81 characters, `0` or `.` for blanks, read row by row. */
  cells: string;
}

/** Outcome of a solve attempt. Discriminated on `status`. */
export type SolveResult =
  | {
      status: "solved";
      /** A fully filled board. Never the same array instance as the input. */
      grid: Grid;
      /** Coordinates the solver filled in, in row-major order. */
      filled: CellRef[];
      /** False when the puzzle admits more than one valid solution. */
      unique: boolean;
      /** Backtracking steps consumed, useful for diagnostics. */
      steps: number;
    }
  | {
      /** The starting board already breaks a Sudoku rule. */
      status: "invalid";
      conflicts: CellRef[];
    }
  | {
      /** The board is legal but no completion exists. */
      status: "unsolvable";
      steps: number;
    }
  | {
      /** Search budget exhausted. Should be unreachable for real puzzles. */
      status: "exhausted";
      steps: number;
    };
