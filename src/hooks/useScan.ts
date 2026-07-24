"use client";

import { useCallback, useRef, useState } from "react";
import { normaliseImage } from "@/lib/image";
import { SCAN_ERROR_MESSAGES, type ScanResult } from "@/lib/scan";

/** Longer than the route's own 30s upstream budget, so the server wins first. */
const CLIENT_TIMEOUT_MS = 45_000;

interface UseScanOptions {
  onSuccess: (cells: string) => void;
  onError: (message: string) => void;
  onStart: () => void;
}

/**
 * Owns the upload side of the photo scan: resize, POST, hand the result back.
 *
 * Kept apart from the board reducer because it is the only asynchronous piece
 * in the app, and the reducer stays pure as a result.
 */
export function useScan({ onStart, onSuccess, onError }: UseScanOptions) {
  const [isScanning, setIsScanning] = useState(false);
  // Guards against a second file landing mid-request, e.g. a fast double drop.
  const inFlight = useRef(false);

  const scan = useCallback(
    async (file: File) => {
      if (inFlight.current) return;

      if (!file.type.startsWith("image/")) {
        onError(SCAN_ERROR_MESSAGES["bad-request"]);
        return;
      }

      inFlight.current = true;
      setIsScanning(true);
      onStart();

      // Hard ceiling on the whole round trip. Without it a stalled upload on a
      // flaky phone connection leaves the spinner running with no way out.
      const abort = new AbortController();
      const timer = window.setTimeout(() => abort.abort(), CLIENT_TIMEOUT_MS);

      try {
        const prepared = await normaliseImage(file);
        const body = new FormData();
        body.append("image", prepared, "grid.jpg");

        const response = await fetch("/api/scan", {
          method: "POST",
          body,
          signal: abort.signal,
        });

        // The route answers with a ScanResult on every path, including errors,
        // but a proxy or a crash could still return something else.
        let result: ScanResult;
        try {
          result = (await response.json()) as ScanResult;
        } catch {
          onError(SCAN_ERROR_MESSAGES.upstream);
          return;
        }

        if (result.ok) onSuccess(result.cells);
        else onError(result.message ?? SCAN_ERROR_MESSAGES.upstream);
      } catch (error) {
        onError(
          error instanceof DOMException && error.name === "AbortError"
            ? "The scan timed out. Check your connection and try again."
            : SCAN_ERROR_MESSAGES.upstream,
        );
      } finally {
        // Runs on every path, including the abort, so the spinner always clears.
        window.clearTimeout(timer);
        inFlight.current = false;
        setIsScanning(false);
      }
    },
    [onStart, onSuccess, onError],
  );

  return { scan, isScanning };
}
