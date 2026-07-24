"use client";

import { DIGITS } from "@/lib/grid";
import { cn } from "@/lib/cn";
import type { Digit } from "@/lib/types";

interface NumberPadProps {
  /** Occurrences of each digit on the board, indexed 1-9. */
  digitCounts: number[];
  disabled: boolean;
  onDigit: (digit: Digit) => void;
  onErase: () => void;
}

/**
 * Touch-first digit entry.
 *
 * The board has no text inputs, so this is the only way in on a phone and a
 * convenient one on desktop. Each key dims once all nine copies of its digit
 * are placed, but stays live: pressing a placed digit on its own cell is how
 * you take it back off.
 */
export function NumberPad({
  digitCounts,
  disabled,
  onDigit,
  onErase,
}: NumberPadProps) {
  return (
    <div
      // One row of ten only while the pad has the full page width. Back to two
      // rows of five in the lg sidebar, where ten columns would be 2rem each.
      className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 lg:grid-cols-5"
      role="group"
      aria-label="Number pad"
      // Every key here acts on the selected cell, so a press must not count as
      // clicking away. `pointerdown` beats `click`, so without this the
      // selection would be gone before the digit ever landed.
      data-keeps-selection=""
    >
      {DIGITS.map((digit) => {
        const placed = digitCounts[digit] ?? 0;
        const complete = placed >= 9;

        return (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(digit)}
            aria-label={`Place ${digit}, ${placed} of 9 on the board`}
            className={cn(
              "group relative flex aspect-4/3 flex-col items-center justify-center",
              "rounded-xl bg-panel ring-1 ring-white/6 ring-inset",
              "transition-all duration-150 sm:aspect-square",
              "hover:bg-panel-hi hover:ring-accent/40",
              "active:translate-y-px disabled:pointer-events-none disabled:opacity-30",
              complete && "opacity-45",
            )}
          >
            <span
              className={cn(
                "font-mono text-xl leading-none tabular-nums sm:text-lg",
                complete ? "text-ink-faint" : "text-ink",
              )}
            >
              {digit}
            </span>
            <span className="mt-1 font-mono text-[10px] leading-none text-ink-faint">
              {placed}/9
            </span>
          </button>
        );
      })}

      <button
        type="button"
        disabled={disabled}
        onClick={onErase}
        aria-label="Erase the selected cell"
        className={cn(
          "flex aspect-4/3 items-center justify-center rounded-xl sm:aspect-square",
          "bg-panel text-ink-dim ring-1 ring-white/6 ring-inset",
          "transition-all duration-150",
          "hover:bg-danger/12 hover:text-danger hover:ring-danger/40",
          "active:translate-y-px disabled:pointer-events-none disabled:opacity-30",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M20 6H9.5a2 2 0 0 0-1.5.7L3 12l5 5.3a2 2 0 0 0 1.5.7H20a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1Z" />
          <path d="m17 9.5-5 5M12 9.5l5 5" />
        </svg>
      </button>
    </div>
  );
}
