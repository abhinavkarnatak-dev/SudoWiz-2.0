import { describe, expect, it } from "vitest";
import { SCAN_SCHEMA, parseScanResponse } from "../scan";
import { countFilled, gridFromString } from "../grid";
import { findConflicts } from "../validation";

const ROWS = [
  "530070000",
  "600195000",
  "098000060",
  "800060003",
  "400803001",
  "700020006",
  "060000280",
  "000419005",
  "000080079",
];

/** The same puzzle in the matrix shape the model is asked to return. */
const GRID: number[][] = ROWS.map((row) => [...row].map(Number));

function reply(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ found: true, grid: GRID, ...overrides });
}

describe("parseScanResponse", () => {
  it("accepts a well formed reply", () => {
    const result = parseScanResponse(reply());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cells).toBe(ROWS.join(""));
    expect(result.cells).toHaveLength(81);
  });

  it("produces a grid the rest of the app can consume", () => {
    const result = parseScanResponse(reply());
    if (!result.ok) throw new Error("expected a successful scan");
    const grid = gridFromString(result.cells);
    expect(countFilled(grid)).toBe(30);
    expect(findConflicts(grid)).toEqual([]);
  });

  it("ignores extra fields the model volunteers", () => {
    const result = parseScanResponse(
      reply({ unreadable: ["R1C1"], confidence: 0.9 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cells).toBe(ROWS.join(""));
  });

  describe("tolerated formatting drift", () => {
    it("accepts digits sent as strings", () => {
      const stringy = GRID.map((row) => row.map(String));
      const result = parseScanResponse(reply({ grid: stringy }));
      if (!result.ok) throw new Error("expected a successful scan");
      expect(result.cells).toBe(ROWS.join(""));
    });

    it("accepts dots, dashes, empty strings and null as blanks", () => {
      const blanks = ["", ".", "-", null];
      const drifted = GRID.map((row, r) =>
        row.map((value, c) => (value === 0 ? blanks[(r + c) % 4] : value)),
      );
      const result = parseScanResponse(reply({ grid: drifted }));
      if (!result.ok) throw new Error("expected a successful scan");
      expect(result.cells).toBe(ROWS.join(""));
    });

    it("trims padded string digits", () => {
      const padded = GRID.map((row) => row.map((value) => ` ${value} `));
      const result = parseScanResponse(reply({ grid: padded }));
      if (!result.ok) throw new Error("expected a successful scan");
      expect(result.cells).toBe(ROWS.join(""));
    });
  });

  describe("rejections", () => {
    it("reports no-grid when the model says it found nothing", () => {
      const result = parseScanResponse(reply({ found: false }));
      expect(result).toMatchObject({ ok: false, error: "no-grid" });
    });

    it.each([
      ["empty output", ""],
      ["undefined output", undefined],
      ["non-JSON", "sorry, I cannot read that image"],
      ["a JSON array", "[1,2,3]"],
      ["JSON null", "null"],
    ])("reports unreadable for %s", (_label, raw) => {
      expect(parseScanResponse(raw)).toMatchObject({
        ok: false,
        error: "unreadable",
      });
    });

    it.each([
      ["too few rows", GRID.slice(0, 8)],
      ["too many rows", [...GRID, Array(9).fill(0)]],
      ["a short row", [...GRID.slice(0, 8), Array(8).fill(0)]],
      ["a long row", [...GRID.slice(0, 8), Array(10).fill(0)]],
      ["a row that is not an array", [...GRID.slice(0, 8), "000000000"]],
      ["a digit above 9", [...GRID.slice(0, 8), [0, 0, 0, 0, 0, 0, 0, 0, 12]]],
      ["a negative digit", [...GRID.slice(0, 8), [0, 0, 0, 0, 0, 0, 0, 0, -1]]],
      ["a fractional digit", [...GRID.slice(0, 8), [0, 0, 0, 0, 0, 0, 0, 0, 4.5]]],
      ["a letter", [...GRID.slice(0, 8), [0, 0, 0, 0, 0, 0, 0, 0, "X"]]],
      ["a nested array", [...GRID.slice(0, 8), [0, 0, 0, 0, 0, 0, 0, 0, [1]]]],
    ])("reports unreadable for %s", (_label, grid) => {
      expect(parseScanResponse(reply({ grid }))).toMatchObject({
        ok: false,
        error: "unreadable",
      });
    });

    it("reports unreadable when grid is missing entirely", () => {
      const raw = JSON.stringify({ found: true, unreadable: [] });
      expect(parseScanResponse(raw)).toMatchObject({
        ok: false,
        error: "unreadable",
      });
    });
  });

  it("passes through a grid that breaks the rules, so the UI can flag it", () => {
    // A misread digit usually surfaces as a duplicate. Parsing must not reject
    // it: the board highlights the clash and the user fixes one cell.
    const broken = [[5, 3, 0, 0, 7, 0, 0, 0, 5], ...GRID.slice(1)];
    const result = parseScanResponse(reply({ grid: broken }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findConflicts(gridFromString(result.cells)).length).toBeGreaterThan(0);
  });
});

describe("SCAN_SCHEMA", () => {
  // The 9x9 integer matrix is what stopped the model shifting digits along a
  // row. Loosening any of these bounds regresses transcription accuracy.
  it("pins the grid to exactly nine rows", () => {
    expect(SCAN_SCHEMA.properties.grid.minItems).toBe(9);
    expect(SCAN_SCHEMA.properties.grid.maxItems).toBe(9);
  });

  it("pins every row to exactly nine integer cells", () => {
    const row = SCAN_SCHEMA.properties.grid.items;
    expect(row.type).toBe("array");
    expect(row.minItems).toBe(9);
    expect(row.maxItems).toBe(9);
    expect(row.items.type).toBe("integer");
    expect(row.items.minimum).toBe(0);
    expect(row.items.maximum).toBe(9);
  });

  it("requires every field the parser reads", () => {
    expect([...SCAN_SCHEMA.required]).toEqual(["found", "grid"]);
  });

  it("asks for nothing beyond found and grid", () => {
    // An extra `unreadable` field here measurably degraded transcription.
    expect(Object.keys(SCAN_SCHEMA.properties).sort()).toEqual(["found", "grid"]);
  });
});
