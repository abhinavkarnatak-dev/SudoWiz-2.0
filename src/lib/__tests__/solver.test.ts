import { describe, expect, it } from "vitest";
import { countSolutions, solveSudoku } from "../solver";
import { createEmptyGrid, gridFromString, gridToString } from "../grid";
import { PUZZLES, getPuzzle } from "../puzzles";
import { findConflicts, isSolvedGrid } from "../validation";
import { isCompleteAndLegal, makeRandom, punchHoles } from "./helpers";

const EASY_SOLUTION =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";

describe("solveSudoku on the sample puzzles", () => {
  it("solves the easy sample to the known answer", () => {
    const result = solveSudoku(gridFromString(getPuzzle("easy").cells));
    expect(result.status).toBe("solved");
    if (result.status !== "solved") return;
    expect(gridToString(result.grid)).toBe(EASY_SOLUTION);
    expect(result.filled).toHaveLength(51);
    expect(result.unique).toBe(true);
  });

  it.each(PUZZLES)("solves the $label sample uniquely", (puzzle) => {
    const start = gridFromString(puzzle.cells);
    const result = solveSudoku(start);

    expect(result.status).toBe("solved");
    if (result.status !== "solved") return;

    expect(isCompleteAndLegal(result.grid)).toBe(true);
    expect(result.unique).toBe(true);

    // Every given must survive untouched in the solution.
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (start[row][col] !== 0) {
          expect(result.grid[row][col]).toBe(start[row][col]);
        }
      }
    }
  });

  it("solves the brute-force stress test without blowing up", () => {
    const result = solveSudoku(gridFromString(getPuzzle("evil").cells));
    expect(result.status).toBe("solved");
    if (result.status !== "solved") return;
    // A row-major solver needs billions of steps here. Candidate ordering
    // brings it down to a few thousand; the ceiling guards the regression.
    expect(result.steps).toBeLessThan(200_000);
  });
});

describe("solveSudoku edge cases", () => {
  it("never mutates the input grid", () => {
    const start = gridFromString(getPuzzle("hard").cells);
    const before = gridToString(start);
    const result = solveSudoku(start);
    expect(gridToString(start)).toBe(before);
    if (result.status === "solved") expect(result.grid).not.toBe(start);
  });

  it("fills an empty board and reports it as ambiguous", () => {
    const result = solveSudoku(createEmptyGrid());
    expect(result.status).toBe("solved");
    if (result.status !== "solved") return;
    expect(isCompleteAndLegal(result.grid)).toBe(true);
    expect(result.filled).toHaveLength(81);
    expect(result.unique).toBe(false);
  });

  it("accepts an already completed board and fills nothing", () => {
    const result = solveSudoku(gridFromString(EASY_SOLUTION));
    expect(result.status).toBe("solved");
    if (result.status !== "solved") return;
    expect(result.filled).toEqual([]);
    expect(result.unique).toBe(true);
    expect(result.steps).toBe(0);
  });

  it("solves a board with a single blank", () => {
    const grid = gridFromString(EASY_SOLUTION);
    const missing = grid[4][6];
    grid[4][6] = 0;

    const result = solveSudoku(grid);
    expect(result.status).toBe("solved");
    if (result.status !== "solved") return;
    expect(result.grid[4][6]).toBe(missing);
    expect(result.filled).toEqual([{ row: 4, col: 6 }]);
  });

  it("reports the offending cells when the givens already clash", () => {
    const grid = gridFromString(getPuzzle("easy").cells);
    grid[0][2] = 5; // row 0 already opens with a 5

    const result = solveSudoku(grid);
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.conflicts).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    ]);
  });

  it("separates an illegal board from a legal but unsolvable one", () => {
    // Row 0 holds 1-8, so its last cell has to be a 9, but column 8 already
    // has one. Nothing is duplicated, so this is legal input with no completion.
    const grid = gridFromString(
      "123456780" + "000000009" + "0".repeat(63),
    );

    expect(findConflicts(grid)).toEqual([]);
    expect(isSolvedGrid(grid)).toBe(false);
    expect(solveSudoku(grid).status).toBe("unsolvable");
  });

  it("detects a puzzle with more than one solution", () => {
    // Erasing every 1 and every 2 makes the two digits interchangeable, so at
    // least two completions exist.
    const grid = gridFromString(EASY_SOLUTION);
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (grid[row][col] === 1 || grid[row][col] === 2) grid[row][col] = 0;
      }
    }

    const result = solveSudoku(grid);
    expect(result.status).toBe("solved");
    if (result.status !== "solved") return;
    expect(result.unique).toBe(false);
    expect(countSolutions(grid, 3)).toBeGreaterThanOrEqual(2);
  });

  it("can skip the uniqueness check", () => {
    const result = solveSudoku(createEmptyGrid(), { checkUniqueness: false });
    expect(result.status).toBe("solved");
    if (result.status !== "solved") return;
    expect(result.unique).toBe(true);
  });
});

describe("countSolutions", () => {
  it("returns one for each sample puzzle", () => {
    for (const puzzle of PUZZLES) {
      expect(countSolutions(gridFromString(puzzle.cells))).toBe(1);
    }
  });

  it("returns zero for an illegal board", () => {
    const grid = createEmptyGrid();
    grid[0][0] = 4;
    grid[0][5] = 4;
    expect(countSolutions(grid)).toBe(0);
  });

  it("stops at the requested limit", () => {
    expect(countSolutions(createEmptyGrid(), 5)).toBe(5);
    expect(countSolutions(createEmptyGrid(), 1)).toBe(1);
  });
});

describe("randomised sweep", () => {
  it("solves 200 puzzles carved out of known solutions", () => {
    const random = makeRandom(20260724);
    const bases = PUZZLES.map((puzzle) => {
      const solved = solveSudoku(gridFromString(puzzle.cells));
      if (solved.status !== "solved") throw new Error("sample did not solve");
      return solved.grid;
    });

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const base = bases[attempt % bases.length];
      const holes = 20 + Math.floor(random() * 45);
      const puzzle = punchHoles(base, holes, random);

      const result = solveSudoku(puzzle, { checkUniqueness: false });
      expect(result.status).toBe("solved");
      if (result.status !== "solved") continue;

      expect(isCompleteAndLegal(result.grid)).toBe(true);

      // Whatever survived the hole punching has to be preserved.
      for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
          if (puzzle[row][col] !== 0) {
            expect(result.grid[row][col]).toBe(puzzle[row][col]);
          }
        }
      }
    }
  });

  it("solves every board that is one cell short of complete", () => {
    const solution = gridFromString(EASY_SOLUTION);

    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const grid = solution.map((line) => line.slice());
        grid[row][col] = 0;

        const result = solveSudoku(grid);
        expect(result.status).toBe("solved");
        if (result.status !== "solved") continue;
        expect(result.unique).toBe(true);
        expect(gridToString(result.grid)).toBe(EASY_SOLUTION);
      }
    }
  });
});
