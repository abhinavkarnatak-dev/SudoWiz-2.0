import { BOX, SIZE, boxIndex, cellKey } from "./grid";
import type { CellRef, CellValue, Grid } from "./types";

/**
 * Rule check for a single placement: is `value` legal at (row, col)?
 *
 * The cell itself is skipped, so this is safe to call for a cell that already
 * holds `value`. Mirrors the original project's `doesNotExist` helper.
 */
export function isSafePlacement(
  grid: Grid,
  row: number,
  col: number,
  value: CellValue,
): boolean {
  if (value === 0) return true;

  for (let i = 0; i < SIZE; i += 1) {
    if (i !== col && grid[row][i] === value) return false;
    if (i !== row && grid[i][col] === value) return false;
  }

  const startRow = row - (row % BOX);
  const startCol = col - (col % BOX);
  for (let r = startRow; r < startRow + BOX; r += 1) {
    for (let c = startCol; c < startCol + BOX; c += 1) {
      if ((r !== row || c !== col) && grid[r][c] === value) return false;
    }
  }

  return true;
}

/**
 * Every cell taking part in a duplicate, anywhere on the board.
 *
 * A single pass builds per-unit occurrence lists, so this is O(81) rather than
 * the O(81 * 27) you get from calling `isSafePlacement` on each cell.
 */
export function findConflicts(grid: Grid): CellRef[] {
  // For each unit and digit, remember where that digit was seen.
  const rows: CellRef[][][] = makeBuckets();
  const cols: CellRef[][][] = makeBuckets();
  const boxes: CellRef[][][] = makeBuckets();

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = grid[row][col];
      if (value === 0) continue;
      const ref = { row, col };
      rows[row][value].push(ref);
      cols[col][value].push(ref);
      boxes[boxIndex(row, col)][value].push(ref);
    }
  }

  const seen = new Set<string>();
  const conflicts: CellRef[] = [];

  for (const unit of [rows, cols, boxes]) {
    for (const digitBuckets of unit) {
      for (const refs of digitBuckets) {
        if (refs.length < 2) continue;
        for (const ref of refs) {
          const key = cellKey(ref.row, ref.col);
          if (seen.has(key)) continue;
          seen.add(key);
          conflicts.push(ref);
        }
      }
    }
  }

  // Row-major order keeps output deterministic for tests and screen readers.
  conflicts.sort((a, b) => a.row - b.row || a.col - b.col);
  return conflicts;
}

/** Conflicting cells as `"row,col"` keys, ready for O(1) lookup while rendering. */
export function findConflictKeys(grid: Grid): Set<string> {
  return new Set(findConflicts(grid).map((ref) => cellKey(ref.row, ref.col)));
}

export function hasConflicts(grid: Grid): boolean {
  return findConflicts(grid).length > 0;
}

/** True when the board is completely filled and breaks no rules. */
export function isSolvedGrid(grid: Grid): boolean {
  for (const row of grid) {
    for (const value of row) if (value === 0) return false;
  }
  return !hasConflicts(grid);
}

/** `unit[digit]` buckets for all 9 units of one kind. Index 0 stays unused. */
function makeBuckets(): CellRef[][][] {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE + 1 }, (): CellRef[] => []),
  );
}
