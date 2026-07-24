import { GoogleGenAI } from "@google/genai";
import {
  MAX_UPLOAD_BYTES,
  SCAN_MODEL,
  SCAN_PROMPT,
  SCAN_SCHEMA,
  SCAN_SYSTEM_INSTRUCTION,
  parseScanResponse,
  scanFailure,
  type ScanErrorCode,
  type ScanResult,
} from "@/lib/scan";

/** The SDK needs Node APIs, and base64 conversion is cheaper off the edge. */
export const runtime = "nodejs";

/** Give up before the platform does, so the client gets a real message. */
const UPSTREAM_TIMEOUT_MS = 30_000;

const STATUS_BY_ERROR: Record<ScanErrorCode, number> = {
  "not-configured": 501,
  "bad-request": 400,
  "too-large": 413,
  "no-grid": 422,
  unreadable: 422,
  upstream: 502,
};

/**
 * Read a Sudoku grid out of an uploaded photo.
 *
 * The API key stays on the server; the browser only ever talks to this route.
 * Responses are always a `ScanResult`, so the client has one shape to handle.
 */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return respond(scanFailure("not-configured"));

  let image: File;
  try {
    const form = await request.formData();
    const field = form.get("image");
    if (!(field instanceof File)) return respond(scanFailure("bad-request"));
    image = field;
  } catch {
    return respond(scanFailure("bad-request"));
  }

  if (!image.type.startsWith("image/")) return respond(scanFailure("bad-request"));
  if (image.size === 0) return respond(scanFailure("bad-request"));
  if (image.size > MAX_UPLOAD_BYTES) return respond(scanFailure("too-large"));

  const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
  const client = new GoogleGenAI({ apiKey });

  try {
    const interaction = await client.interactions.create(
      {
        model: SCAN_MODEL,
        system_instruction: SCAN_SYSTEM_INSTRUCTION,
        input: [
          { type: "text", text: SCAN_PROMPT },
          {
            type: "image",
            data: base64,
            mime_type: image.type,
            // Dense 9x9 transcription needs the detail; the default sampling
            // loses thin digits in a photographed grid.
            resolution: "high",
          },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: SCAN_SCHEMA,
        },
      },
      { timeout: UPSTREAM_TIMEOUT_MS },
    );

    return respond(parseScanResponse(interaction.output_text));
  } catch (error) {
    // The key itself could appear in an upstream error, so log server-side only
    // and hand the client a generic message.
    console.error("[scan] upstream call failed:", error);
    return respond(scanFailure("upstream"));
  }
}

function respond(result: ScanResult): Response {
  return Response.json(result, {
    status: result.ok ? 200 : STATUS_BY_ERROR[result.error],
  });
}
