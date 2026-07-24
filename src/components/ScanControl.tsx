"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageCropper } from "./ImageCropper";
import { cn } from "@/lib/cn";

interface ScanControlProps {
  isScanning: boolean;
  onFile: (file: File) => void;
}

/**
 * Photo entry point: take a picture, pick a file, drop one on the panel, or
 * paste a screenshot.
 *
 * Two separate file inputs rather than one. The library input omits `capture`
 * so a phone still offers the gallery, and a second input sets
 * `capture="environment"` to jump straight to the rear camera. One input cannot
 * do both: adding `capture` removes the gallery option entirely.
 *
 * Whichever route the image arrives by, it goes through the cropper first.
 */
export function ScanControl({ isScanning, onFile }: ScanControlProps) {
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Image waiting to be cropped. Non-null means the cropper is open.
  const [pending, setPending] = useState<File | null>(null);

  const accept = useCallback((file: File | undefined | null) => {
    if (file && file.type.startsWith("image/")) setPending(file);
  }, []);

  // Paste is the fastest path on desktop: screenshot the puzzle, hit Ctrl+V.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.items ?? [])]
        .find((item) => item.type.startsWith("image/"))
        ?.getAsFile();
      if (!file) return;
      event.preventDefault();
      accept(file);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [accept]);

  return (
    <>
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        accept(event.dataTransfer.files[0]);
      }}
      className={cn(
        "rounded-xl border border-dashed transition-colors duration-150",
        isScanning
          ? "border-accent/40 bg-accent/5"
          : isDragging
            ? "border-accent bg-accent/8"
            : "border-white/10",
      )}
    >
      {/*
        Both inputs stay out of the tab order and out of focus. The visible
        buttons are the real controls, and a focused file input would make the
        window key handler treat every keypress as text entry.
      */}
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          // Reset so picking the same file twice still fires a change.
          event.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div className="flex items-stretch gap-1 p-1">
        {isScanning ? (
          // One indicator spanning the panel. Leaving it inside a single button
          // read as though only that button was busy.
          <div
            role="status"
            aria-live="polite"
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-accent"
          >
            <SpinnerIcon />
            <span>Reading the grid...</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className={cn(
                "touch-only flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2",
                "text-sm text-ink-dim transition-all duration-150",
                "hover:bg-panel-hi hover:text-ink active:translate-y-px",
              )}
            >
              <CameraIcon />
              <span>Take photo</span>
            </button>

            {/* Divides the two entry points. Touch-only, since the camera button
                it separates is hidden on pointer devices. */}
            <span
              aria-hidden="true"
              className="touch-only my-1.5 w-px shrink-0 self-stretch bg-white/10"
            />

            <button
              type="button"
              onClick={() => libraryRef.current?.click()}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2",
                "text-sm text-ink-dim transition-all duration-150",
                "hover:bg-panel-hi hover:text-ink active:translate-y-px",
              )}
            >
              <ImageIcon />
              <span>Scan a photo</span>
              <span className="hidden font-mono text-[10px] text-ink-faint sm:inline">
                drop or paste too
              </span>
            </button>
          </>
        )}
      </div>
    </div>

    {pending && (
      <ImageCropper
        // Remount per image so the crop box and load state start fresh.
        key={`${pending.name}-${pending.size}-${pending.lastModified}`}
        file={pending}
        onCancel={() => setPending(null)}
        onConfirm={(cropped) => {
          setPending(null);
          onFile(cropped);
        }}
      />
    )}
    </>
  );
}

function ImageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 16.5 4.2-3.8a2 2 0 0 1 2.7 0L15 16.5m0 0 1.8-1.6a2 2 0 0 1 2.7 0L21 16.5" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1.5 1.5 0 0 0 1.25-.67l.6-.9A1.5 1.5 0 0 1 9.8 4.8h4.4a1.5 1.5 0 0 1 1.25.67l.6.9A1.5 1.5 0 0 0 17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" />
      <circle cx="12" cy="12.8" r="3.2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="h-4 w-4 shrink-0 animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}
