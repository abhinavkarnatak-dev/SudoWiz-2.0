/**
 * Contract for the photo-to-grid scan, shared by the API route and the client.
 *
 * Everything here is pure so the parsing rules can be tested without a network
 * call or an API key.
 */

/**
 * Low-latency multimodal model, tuned by Google for document parsing, which is
 * exactly the job here. Note that `temperature`, `top_p` and `top_k` are
 * deprecated from this generation onward and must not be sent.
 */
export const SCAN_MODEL = "gemini-3.5-flash-lite";

/** Refused above this. The client resizes first, so this is a backstop. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Longest edge the client normalises every upload to, scaling up as well as
 * down.
 *
 * Resolution is the single biggest lever on transcription accuracy. The same
 * grid rendered at 580px scored 0/3 exact; at 1256px it scored 3/3. Bicubic
 * upscaling of the 580px original to 1400px also scored 3/3, so what matters is
 * the pixel count handed to the model, not the detail actually present. Small
 * screenshots are common, so they get scaled up rather than passed through.
 */
export const TARGET_IMAGE_EDGE = 1400;

export const SCAN_SYSTEM_INSTRUCTION =
  "You transcribe Sudoku grids from images. You copy exactly what is printed. " +
  "You never solve the puzzle and never infer a digit that is not visibly there.";

export const SCAN_PROMPT = [
  "Transcribe the 9x9 Sudoku grid in this image.",
  "",
  "Return `grid`: 9 arrays, one per grid row, top to bottom.",
  "Each inner array holds exactly 9 integers, one per column, left to right.",
  "",
  "Rules:",
  "- Use the printed digit 1-9 for a filled cell.",
  "- Use 0 for a blank cell.",
  "- Every row must have all 9 entries. Count the columns carefully: columns 1-3",
  "  are the left block, 4-6 the middle block, 7-9 the right block.",
  "- Do not solve the puzzle. Transcribe only what is printed.",
  "- Ignore pencil marks, candidate lists and small corner notes. Those cells are blank.",
  "- If the image does not clearly show a 9x9 Sudoku grid, set `found` to false.",
].join("\n");

/**
 * JSON Schema handed to the model to constrain its output.
 *
 * The nesting is load-bearing, not cosmetic. Asking for nine 9-character
 * strings, or for a list of {row, col, digit} coordinates, both produced
 * consistent column-shift errors in testing: the model would misjudge a run of
 * blanks and slide the rest of the row over by one. A fixed 9x9 matrix of
 * integers gives structured decoding an explicit slot per cell, and it cannot
 * emit a short or long row without violating the schema. That change alone took
 * transcription from 0/3 to 3/3 exact on the same image.
 *
 * The schema is also kept minimal on purpose. An earlier version asked for an
 * extra `unreadable` list of low-confidence cells alongside the grid, and that
 * one added field dropped accuracy from 3/3 to 1/3 on the same input: making
 * the model score its own confidence while transcribing costs it transcription.
 * Misreads are caught instead by the board's own duplicate detection, which is
 * free and needs no cooperation from the model. See scripts/scan-eval.mjs.
 */
export const SCAN_SCHEMA = {
  type: "object",
  properties: {
    found: {
      type: "boolean",
      description: "True only if a 9x9 Sudoku grid is clearly visible.",
    },
    grid: {
      type: "array",
      description: "Nine rows of nine integers, 0 for a blank cell.",
      minItems: 9,
      maxItems: 9,
      items: {
        type: "array",
        minItems: 9,
        maxItems: 9,
        items: { type: "integer", minimum: 0, maximum: 9 },
      },
    },
  },
  required: ["found", "grid"],
} as const;

export type ScanErrorCode =
  | "not-configured"
  | "bad-request"
  | "too-large"
  | "no-grid"
  | "unreadable"
  | "upstream";

export interface ScanSuccess {
  ok: true;
  /** 81 characters, row by row, `0` for blank. */
  cells: string;
}

export interface ScanFailure {
  ok: false;
  error: ScanErrorCode;
  message: string;
}

export type ScanResult = ScanSuccess | ScanFailure;

/** User-facing copy for each failure mode, kept in one place. */
export const SCAN_ERROR_MESSAGES: Record<ScanErrorCode, string> = {
  "not-configured":
    "Scanning is not set up. Add GEMINI_API_KEY to .env.local and restart the server.",
  "bad-request": "That file was not an image. Try a photo or screenshot.",
  "too-large": "That image is too large. Try a smaller photo.",
  "no-grid": "No Sudoku grid was found in that image. Try a straighter, closer shot.",
  unreadable:
    "The grid came back unreadable. Try a sharper photo with the whole grid in frame.",
  upstream: "The scan service did not respond. Check your connection and try again.",
};

export function scanFailure(error: ScanErrorCode): ScanFailure {
  return { ok: false, error, message: SCAN_ERROR_MESSAGES[error] };
}

/**
 * Validate and normalise the model's JSON reply.
 *
 * Deliberately forgiving about formatting the model might drift on (stray
 * whitespace, `.` or `-` used for blanks) and strict about anything that would
 * corrupt the board (wrong row count, wrong row length, non-digits).
 */
export function parseScanResponse(raw: string | undefined): ScanResult {
  if (!raw || raw.trim() === "") return scanFailure("unreadable");

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return scanFailure("unreadable");
  }

  if (typeof payload !== "object" || payload === null) {
    return scanFailure("unreadable");
  }

  const { found, grid } = payload as {
    found?: unknown;
    grid?: unknown;
  };

  if (found === false) return scanFailure("no-grid");
  if (!Array.isArray(grid) || grid.length !== 9) {
    return scanFailure("unreadable");
  }

  const cells: string[] = [];
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== 9) return scanFailure("unreadable");
    for (const entry of row) {
      const digit = toDigit(entry);
      if (digit === null) return scanFailure("unreadable");
      cells.push(digit);
    }
  }

  return { ok: true, cells: cells.join("") };
}

/**
 * Coerce one cell to a single character, or null if it is not a legal value.
 * Integers are what the schema asks for; the string and blank forms are drift
 * the model occasionally produces and are cheap to accept.
 */
function toDigit(entry: unknown): string | null {
  if (typeof entry === "number") {
    return Number.isInteger(entry) && entry >= 0 && entry <= 9
      ? String(entry)
      : null;
  }
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    if (trimmed === "" || trimmed === "." || trimmed === "-") return "0";
    return /^[0-9]$/.test(trimmed) ? trimmed : null;
  }
  if (entry === null || entry === undefined) return "0";
  return null;
}

