import { describe, expect, it } from "vitest";
import { cellKey, createEmptyGrid, gridFromString } from "../grid";
import {
  findConflictKeys,
  findConflicts,
  hasConflicts,
  isSafePlacement,
  isSolvedGrid,
} from "../validation";
import { PUZZLES } from "../puzzles";

const SOLVED = gridFromString(
  "534678912" +
    "672195348" +
    "198342567" +
    "859761423" +
    "426853791" +
    "713924856" +
    "961537284" +
    "287419635" +
    "345286179",
);

describe("findConflicts", () => {
  it("finds nothing on an empty board", () => {
    expect(findConflicts(createEmptyGrid())).toEqual([]);
    expect(hasConflicts(createEmptyGrid())).toBe(false);
  });

  it("finds nothing on a legal puzzle or a completed board", () => {
    for (const puzzle of PUZZLES) {
      expect(findConflicts(gridFromString(puzzle.cells))).toEqual([]);
    }
    expect(findConflicts(SOLVED)).toEqual([]);
  });

  it("flags both cells of a row duplicate", () => {
    const grid = createEmptyGrid();
    grid[3][0] = 7;
    grid[3][8] = 7;
    expect(findConflictKeys(grid)).toEqual(new Set(["3,0", "3,8"]));
  });

  it("flags both cells of a column duplicate", () => {
    const grid = createEmptyGrid();
    grid[0][4] = 2;
    grid[7][4] = 2;
    expect(findConflictKeys(grid)).toEqual(new Set(["0,4", "7,4"]));
  });

  it("flags both cells of a box duplicate that shares no row or column", () => {
    const grid = createEmptyGrid();
    grid[6][6] = 4;
    grid[8][8] = 4;
    expect(findConflictKeys(grid)).toEqual(new Set(["6,6", "8,8"]));
  });

  it("flags every cell of a three-way duplicate", () => {
    const grid = createEmptyGrid();
    grid[0][0] = 5;
    grid[0][4] = 5;
    grid[0][8] = 5;
    expect(findConflictKeys(grid)).toEqual(new Set(["0,0", "0,4", "0,8"]));
  });

  it("reports a cell once even when it clashes on two axes", () => {
    const grid = createEmptyGrid();
    grid[4][4] = 9;
    grid[4][0] = 9; // same row
    grid[0][4] = 9; // same column
    const conflicts = findConflicts(grid);
    expect(conflicts).toHaveLength(3);
    expect(new Set(conflicts.map((ref) => cellKey(ref.row, ref.col))).size).toBe(
      3,
    );
  });

  it("does not flag the same digit in a different row, column and box", () => {
    const grid = createEmptyGrid();
    grid[0][0] = 6;
    grid[4][4] = 6;
    grid[8][8] = 6;
    expect(findConflicts(grid)).toEqual([]);
  });

  it("never treats empty cells as duplicates", () => {
    const grid = createEmptyGrid();
    grid[0][0] = 1;
    expect(findConflicts(grid)).toEqual([]);
  });

  it("returns conflicts in row-major order", () => {
    const grid = createEmptyGrid();
    grid[8][1] = 3;
    grid[0][1] = 3;
    grid[4][1] = 3;
    expect(findConflicts(grid)).toEqual([
      { row: 0, col: 1 },
      { row: 4, col: 1 },
      { row: 8, col: 1 },
    ]);
  });
});

describe("isSafePlacement", () => {
  it("rejects a digit already present in the row, column or box", () => {
    const grid = createEmptyGrid();
    grid[2][2] = 8;
    expect(isSafePlacement(grid, 2, 5, 8)).toBe(false); // same row
    expect(isSafePlacement(grid, 5, 2, 8)).toBe(false); // same column
    expect(isSafePlacement(grid, 0, 0, 8)).toBe(false); // same box
    expect(isSafePlacement(grid, 5, 5, 8)).toBe(true); // unrelated
  });

  it("ignores the cell's own value so re-entering a digit is legal", () => {
    const grid = createEmptyGrid();
    grid[2][2] = 8;
    expect(isSafePlacement(grid, 2, 2, 8)).toBe(true);
  });

  it("treats a blank as always safe", () => {
    expect(isSafePlacement(SOLVED, 0, 0, 0)).toBe(true);
  });

  it("agrees with a completed board", () => {
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        expect(isSafePlacement(SOLVED, row, col, SOLVED[row][col])).toBe(true);
      }
    }
  });
});

describe("isSolvedGrid", () => {
  it("is true only for a full, legal board", () => {
    expect(isSolvedGrid(SOLVED)).toBe(true);
    expect(isSolvedGrid(createEmptyGrid())).toBe(false);
    expect(isSolvedGrid(gridFromString(PUZZLES[0].cells))).toBe(false);
  });

  it("is false for a full board that breaks a rule", () => {
    const broken = SOLVED.map((row) => row.slice());
    broken[0][0] = broken[0][1];
    expect(isSolvedGrid(broken)).toBe(false);
  });
});
