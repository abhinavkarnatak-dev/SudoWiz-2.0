import { describe, expect, it } from "vitest";
import {
  boxIndex,
  cellKey,
  cloneGrid,
  countDigits,
  countFilled,
  createEmptyGrid,
  createEmptyOrigins,
  gridFromString,
  gridToString,
  isGridEmpty,
  isGridFull,
  isInBounds,
  originsFromGrid,
} from "../grid";
import { PUZZLES } from "../puzzles";

const SOLVED =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";

describe("createEmptyGrid", () => {
  it("builds a 9x9 board of zeroes", () => {
    const grid = createEmptyGrid();
    expect(grid).toHaveLength(9);
    expect(grid.every((row) => row.length === 9)).toBe(true);
    expect(isGridEmpty(grid)).toBe(true);
    expect(countFilled(grid)).toBe(0);
  });

  it("gives each row its own array", () => {
    const grid = createEmptyGrid();
    grid[0][0] = 5;
    expect(grid[1][0]).toBe(0);
  });
});

describe("cloneGrid", () => {
  it("produces an independent copy", () => {
    const original = gridFromString(SOLVED);
    const copy = cloneGrid(original);
    copy[4][4] = 1;
    expect(original[4][4]).not.toBe(1);
    expect(copy).not.toBe(original);
    expect(copy[0]).not.toBe(original[0]);
  });
});

describe("gridFromString", () => {
  it("round-trips through gridToString", () => {
    expect(gridToString(gridFromString(SOLVED))).toBe(SOLVED);
  });

  it("reads row by row", () => {
    const grid = gridFromString(PUZZLES[0].cells);
    expect(grid[0][0]).toBe(5);
    expect(grid[0][1]).toBe(3);
    expect(grid[0][2]).toBe(0);
    expect(grid[8][8]).toBe(9);
  });

  it("accepts dots, dashes and zeroes as blanks", () => {
    const dots = ".".repeat(81);
    const dashes = "-".repeat(81);
    const zeroes = "0".repeat(81);
    expect(isGridEmpty(gridFromString(dots))).toBe(true);
    expect(isGridEmpty(gridFromString(dashes))).toBe(true);
    expect(isGridEmpty(gridFromString(zeroes))).toBe(true);
  });

  it("ignores whitespace and newlines", () => {
    const spaced = SOLVED.match(/.{9}/g)!.join("\n");
    expect(gridToString(gridFromString(spaced))).toBe(SOLVED);
  });

  it("rejects the wrong number of cells", () => {
    expect(() => gridFromString("123")).toThrow(/81 characters/);
    expect(() => gridFromString("0".repeat(82))).toThrow(/81 characters/);
  });

  it("rejects non-numeric characters", () => {
    expect(() => gridFromString("x" + "0".repeat(80))).toThrow(/Unexpected/);
  });
});

describe("isGridFull and countFilled", () => {
  it("agrees with the number of non-empty cells", () => {
    const puzzle = gridFromString(PUZZLES[0].cells);
    expect(isGridFull(puzzle)).toBe(false);
    expect(countFilled(puzzle)).toBe(30);

    const solved = gridFromString(SOLVED);
    expect(isGridFull(solved)).toBe(true);
    expect(countFilled(solved)).toBe(81);
  });
});

describe("countDigits", () => {
  it("counts nine of each digit in a completed board", () => {
    const counts = countDigits(gridFromString(SOLVED));
    for (let digit = 1; digit <= 9; digit += 1) {
      expect(counts[digit]).toBe(9);
    }
  });

  it("never reports blanks", () => {
    expect(countDigits(createEmptyGrid())[0]).toBe(0);
  });
});

describe("boxIndex", () => {
  it("maps corners and centre to the expected boxes", () => {
    expect(boxIndex(0, 0)).toBe(0);
    expect(boxIndex(0, 8)).toBe(2);
    expect(boxIndex(4, 4)).toBe(4);
    expect(boxIndex(8, 0)).toBe(6);
    expect(boxIndex(8, 8)).toBe(8);
  });

  it("puts every cell of a 3x3 block in the same box", () => {
    const boxes = new Set<number>();
    for (let row = 3; row < 6; row += 1) {
      for (let col = 6; col < 9; col += 1) boxes.add(boxIndex(row, col));
    }
    expect(boxes).toEqual(new Set([5]));
  });
});

describe("isInBounds", () => {
  it("accepts the board and rejects everything outside it", () => {
    expect(isInBounds(0, 0)).toBe(true);
    expect(isInBounds(8, 8)).toBe(true);
    expect(isInBounds(-1, 0)).toBe(false);
    expect(isInBounds(0, 9)).toBe(false);
    expect(isInBounds(9, 9)).toBe(false);
  });
});

describe("cellKey", () => {
  it("is unique per coordinate", () => {
    const keys = new Set<string>();
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) keys.add(cellKey(row, col));
    }
    expect(keys.size).toBe(81);
  });
});

describe("originsFromGrid", () => {
  it("marks filled cells as given and blanks as empty", () => {
    const grid = gridFromString(PUZZLES[0].cells);
    const origins = originsFromGrid(grid);
    expect(origins[0][0]).toBe("given");
    expect(origins[0][2]).toBe("empty");
  });

  it("starts fully empty for a blank origin matrix", () => {
    const origins = createEmptyOrigins();
    expect(origins.flat().every((entry) => entry === "empty")).toBe(true);
  });
});
