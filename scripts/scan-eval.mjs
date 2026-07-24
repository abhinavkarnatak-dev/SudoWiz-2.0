/**
 * Accuracy harness for the photo scan.
 *
 *   node --env-file=.env.local scripts/scan-eval.mjs <image.png> <expected81> [runs]
 *
 * Runs the shipped prompt and schema against a grid whose contents are known
 * and reports the exact-match rate plus the per-cell error count. Use it before
 * and after touching anything in src/lib/scan.ts.
 *
 * What this harness established, all on the same source grid:
 *
 *   nine 9-character strings, 1256px ......... 0/3 exact, 4.0 cells wrong
 *   list of {row, col, digit}, 1256px ........ 0/3 exact, 5.0 cells wrong
 *   9x9 integer matrix, 1256px ............... 3/3 exact
 *   9x9 matrix + an `unreadable` field ....... 1/3 exact, 21.3 cells wrong
 *   9x9 integer matrix, 580px ................ 0/3 exact, 17.0 cells wrong
 *   9x9 matrix, 580px upscaled to 1400px ..... 3/3 exact
 *
 * So: constrain the output to a fixed 9x9 matrix, ask for nothing else
 * alongside it, and feed the model a large enough image. `ultra_high` media
 * resolution matched `high` everywhere and costs more, so `high` ships.
 */
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.5-flash-lite";

// Kept in step with src/lib/scan.ts by hand: this file is plain JS so it can
// run under `node --env-file` with no build step.
const SYSTEM =
  "You transcribe Sudoku grids from images. You copy exactly what is printed. " +
  "You never solve the puzzle and never infer a digit that is not visibly there.";

const PROMPT = [
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

const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    grid: {
      type: "array",
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
};

const [imagePath, expected, runsArg] = process.argv.slice(2);
if (!imagePath || !expected || expected.length !== 81) {
  console.error("usage: scan-eval.mjs <image> <81-char expected> [runs]");
  process.exit(1);
}

const runs = Number(runsArg ?? 3);
const base64 = readFileSync(imagePath, { encoding: "base64" });
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function decode(payload) {
  if (!Array.isArray(payload?.grid) || payload.grid.length !== 9) return null;
  const out = [];
  for (const row of payload.grid) {
    if (!Array.isArray(row) || row.length !== 9) return null;
    for (const value of row) {
      if (!Number.isInteger(value) || value < 0 || value > 9) return null;
      out.push(String(value));
    }
  }
  return out.join("");
}

let exact = 0;
let totalDiff = 0;
let failures = 0;
let totalMs = 0;

for (let run = 0; run < runs; run += 1) {
  const started = Date.now();
  try {
    const interaction = await client.interactions.create({
      model: MODEL,
      system_instruction: SYSTEM,
      input: [
        { type: "text", text: PROMPT },
        {
          type: "image",
          data: base64,
          mime_type: "image/png",
          resolution: "high",
        },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: SCHEMA,
      },
    });
    totalMs += Date.now() - started;

    const cells = decode(JSON.parse(interaction.output_text ?? "{}"));
    if (!cells) {
      failures += 1;
      continue;
    }

    let wrong = 0;
    for (let i = 0; i < 81; i += 1) if (cells[i] !== expected[i]) wrong += 1;
    totalDiff += wrong;
    if (wrong === 0) exact += 1;
    else console.log(`  run ${run + 1}: ${wrong} wrong -> ${cells}`);
  } catch (error) {
    failures += 1;
    console.log(`  run ${run + 1} error: ${error?.message ?? error}`);
  }
}

console.log(
  `exact ${exact}/${runs}  avg wrong cells ${(totalDiff / runs).toFixed(1)}  ` +
    `parse fails ${failures}  avg ${Math.round(totalMs / runs)}ms`,
);
