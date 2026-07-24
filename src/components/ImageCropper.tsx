"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface ImageCropperProps {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

/** Crop box as fractions of the image, so it survives any display size. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle = "nw" | "ne" | "sw" | "se";
type DragMode = "move" | Handle;

/** Smallest crop, as a fraction. Stops the box collapsing to nothing. */
const MIN_SIZE = 0.08;

/** Starting box: the whole image, inset enough that the handles are grabbable. */
const INITIAL: Rect = { x: 0.04, y: 0.04, w: 0.92, h: 0.92 };

const HANDLES: { id: Handle; className: string }[] = [
  { id: "nw", className: "-top-2 -left-2 cursor-nwse-resize" },
  { id: "ne", className: "-top-2 -right-2 cursor-nesw-resize" },
  { id: "sw", className: "-bottom-2 -left-2 cursor-nesw-resize" },
  { id: "se", className: "-bottom-2 -right-2 cursor-nwse-resize" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Full-screen crop step shown between picking an image and scanning it.
 *
 * Cropping is not just tidiness: the scan is far more accurate when the grid
 * fills the frame, because the image is normalised to a fixed long edge before
 * upload. Trimming the desk, fingers and page margins out of a phone photo
 * spends all of those pixels on the puzzle.
 *
 * Deliberately hand-rolled rather than pulling in a crop library. The gesture
 * needed here is drag-to-move and drag-a-corner-to-resize over an image already
 * fitted to the screen; there is no pan or pinch-zoom to get right, so a
 * dependency would cost more than it saves.
 */
export function ImageCropper({ file, onCancel, onConfirm }: ImageCropperProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect>(INITIAL);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; start: Rect } | null>(
    null,
  );

  /*
   * The object URL must be created and revoked by the same effect.
   *
   * An earlier version built it in a `useState` initialiser and revoked it in a
   * separate cleanup. Under StrictMode, which Next enables in development,
   * React mounts, unmounts and remounts: the cleanup revoked the only URL and
   * nothing ever made another, so the image silently failed to load, `onLoad`
   * never fired, and the crop box never appeared. Pairing them here means the
   * remount creates a fresh URL to replace the one it just released.
   *
   * This is the case the set-state-in-effect rule is wrong about: the URL is an
   * external resource with a lifecycle, which is exactly what effects are for.
   */
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const beginDrag = useCallback(
    (event: React.PointerEvent, mode: DragMode) => {
      event.preventDefault();
      event.stopPropagation();
      (event.target as Element).setPointerCapture?.(event.pointerId);
      drag.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        start: rect,
      };
    },
    [rect],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const active = drag.current;
    const image = imgRef.current;
    if (!active || !image) return;

    const bounds = image.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;

    // Pointer travel expressed in the same fractions the rect uses.
    const dx = (event.clientX - active.startX) / bounds.width;
    const dy = (event.clientY - active.startY) / bounds.height;
    const start = active.start;

    setRect(() => {
      if (active.mode === "move") {
        return {
          ...start,
          x: clamp(start.x + dx, 0, 1 - start.w),
          y: clamp(start.y + dy, 0, 1 - start.h),
        };
      }

      // Resize from a corner: the opposite edges stay pinned.
      const right = start.x + start.w;
      const bottom = start.y + start.h;
      let { x, y, w, h } = start;

      if (active.mode === "nw" || active.mode === "sw") {
        x = clamp(start.x + dx, 0, right - MIN_SIZE);
        w = right - x;
      } else {
        w = clamp(start.w + dx, MIN_SIZE, 1 - start.x);
      }

      if (active.mode === "nw" || active.mode === "ne") {
        y = clamp(start.y + dy, 0, bottom - MIN_SIZE);
        h = bottom - y;
      } else {
        h = clamp(start.h + dy, MIN_SIZE, 1 - start.y);
      }

      return { x, y, w, h };
    });
  }, []);

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  const confirm = useCallback(async () => {
    if (busy) return;
    const image = imgRef.current;
    // The browser could not decode it for preview, but the API still accepts
    // HEIC and friends, so send the untouched file rather than dead-ending.
    if (!image) {
      onConfirm(file);
      return;
    }
    setBusy(true);

    try {
      const sx = Math.round(rect.x * image.naturalWidth);
      const sy = Math.round(rect.y * image.naturalHeight);
      const sw = Math.max(1, Math.round(rect.w * image.naturalWidth));
      const sh = Math.max(1, Math.round(rect.h * image.naturalHeight));

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const context = canvas.getContext("2d");
      if (!context) {
        // Nothing to gain from failing here: send the original instead.
        onConfirm(file);
        return;
      }

      context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.95);
      });

      // The upload step scales this to the target edge, so full crop
      // resolution is handed over here rather than downsized twice.
      onConfirm(
        blob
          ? new File([blob], "grid.jpg", { type: "image/jpeg" })
          : file,
      );
    } catch {
      onConfirm(file);
    } finally {
      setBusy(false);
    }
  }, [busy, file, onConfirm, rect]);

  return (
    <div
      // Marks a blocking overlay so the board's global key handler stands down.
      data-blocking-modal=""
      role="dialog"
      aria-modal="true"
      aria-label="Crop the puzzle"
      className="fixed inset-0 z-50 flex flex-col bg-canvas/95 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-mono text-[11px] tracking-wide text-ink-dim">
          Drag the corners so the grid fills the box
        </p>
        <button
          type="button"
          onClick={() => setRect(INITIAL)}
          className="rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-ink-faint transition-colors hover:bg-panel hover:text-ink"
        >
          Reset
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        <div className="relative">
          {failed && (
            <p className="max-w-xs text-center text-sm text-danger">
              That image could not be opened. Try a different photo, or a JPEG
              or PNG if this came from a screenshot tool.
            </p>
          )}

          {url && !failed && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              ref={imgRef}
              src={url}
              alt="Puzzle to crop"
              onLoad={() => setReady(true)}
              onError={() => setFailed(true)}
              className="max-h-[62vh] max-w-full rounded-xl object-contain select-none"
              draggable={false}
            />
          )}

          {ready && (
            <div
              // `touch-action: none` is what stops the page scrolling under a
              // drag on a phone; without it the crop box barely moves.
              className="absolute inset-0 touch-none"
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {/* Dim everything outside the selection. */}
              <div
                className="pointer-events-none absolute inset-0 rounded-xl bg-canvas/65"
                style={{
                  clipPath: `polygon(0% 0%, 0% 100%, ${rect.x * 100}% 100%, ${
                    rect.x * 100
                  }% ${rect.y * 100}%, ${(rect.x + rect.w) * 100}% ${
                    rect.y * 100
                  }%, ${(rect.x + rect.w) * 100}% ${
                    (rect.y + rect.h) * 100
                  }%, ${rect.x * 100}% ${(rect.y + rect.h) * 100}%, ${
                    rect.x * 100
                  }% 100%, 100% 100%, 100% 0%)`,
                }}
              />

              <div
                onPointerDown={(event) => beginDrag(event, "move")}
                className="absolute cursor-move ring-2 ring-accent"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                }}
              >
                {HANDLES.map((handle) => (
                  <span
                    key={handle.id}
                    onPointerDown={(event) => beginDrag(event, handle.id)}
                    className={cn(
                      "absolute h-5 w-5 rounded-full border-2 border-canvas bg-accent",
                      handle.className,
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 pt-3 pb-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl bg-panel px-4 py-3 text-sm text-ink-dim ring-1 ring-white/8 transition-colors ring-inset hover:bg-panel-hi hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={(!ready && !failed) || busy}
          className="flex-[2] rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-canvas transition-all hover:bg-accent/90 active:translate-y-px disabled:opacity-40"
        >
          {busy
            ? "Preparing..."
            : failed
              ? "Scan without cropping"
              : "Scan this area"}
        </button>
      </div>
    </div>
  );
}
