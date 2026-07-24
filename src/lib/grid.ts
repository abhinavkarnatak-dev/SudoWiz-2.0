import type { CellOrigin, CellValue, Grid, OriginGrid } from "./types";

export const SIZE = 9;
export const BOX = 3;
export const CELL_COUNT = SIZE * SIZE;

/** All valid digits, in ascending order. */
export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** A new 9x9 board with every cell empty. */
export function createEmptyGrid(): Grid {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => 0 as CellValue),
  );
}

/** A new 9x9 origin matrix with every cell marked empty. */
export function createEmptyOrigins(): OriginGrid {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => "empty" as CellOrigin),
  );
}

/** Deep copy of a board. Rows are copied so mutation cannot leak. */
export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice());
}

export function cloneOrigins(origins: OriginGrid): OriginGrid {
  return origins.map((row) => row.slice());
}

export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

/** Index 0-8 of the 3x3 box containing (row, col), read left to right, top to bottom. */
export function boxIndex(row: number, col: number): number {
  return Math.floor(row / BOX) * BOX + Math.floor(col / BOX);
}

/** Stable string key for a coordinate, used for Set membership in the UI. */
export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function isGridEmpty(grid: Grid): boolean {
  return grid.every((row) => row.every((value) => value === 0));
}

export function isGridFull(grid: Grid): boolean {
  return grid.every((row) => row.every((value) => value !== 0));
}

export function countFilled(grid: Grid): number {
  let total = 0;
  for (const row of grid) {
    for (const value of row) if (value !== 0) total += 1;
  }
  return total;
}

/** How many times each digit 1-9 appears. Index 0 is unused and always 0. */
export function countDigits(grid: Grid): number[] {
  const counts = new Array<number>(SIZE + 1).fill(0);
  for (const row of grid) {
    for (const value of row) counts[value] += 1;
  }
  counts[0] = 0;
  return counts;
}

/**
 * Parse an 81-character puzzle string into a board.
 * `0`, `.` and `-` are all treated as blanks.
 *
 * @throws if the string is not exactly 81 usable characters.
 */
export function gridFromString(input: string): Grid {
  const cleaned = input.replace(/\s/g, "");
  if (cleaned.length !== CELL_COUNT) {
    throw new Error(
      `Expected ${CELL_COUNT} characters, received ${cleaned.length}`,
    );
  }

  const grid = createEmptyGrid();
  for (let i = 0; i < CELL_COUNT; i += 1) {
    const char = cleaned[i];
    if (char === "0" || char === "." || char === "-") continue;
    const digit = Number(char);
    if (!Number.isInteger(digit) || digit < 1 || digit > 9) {
      throw new Error(`Unexpected character "${char}" at index ${i}`);
    }
    grid[Math.floor(i / SIZE)][i % SIZE] = digit as CellValue;
  }
  return grid;
}

/** Serialise a board back to an 81-character string, using `0` for blanks. */
export function gridToString(grid: Grid): string {
  return grid.map((row) => row.join("")).join("");
}

/** Origin matrix for a freshly loaded puzzle: filled cells become givens. */
export function originsFromGrid(grid: Grid): OriginGrid {
  return grid.map((row) =>
    row.map((value): CellOrigin => (value === 0 ? "empty" : "given")),
  );
}
