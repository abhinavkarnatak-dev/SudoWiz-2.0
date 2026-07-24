"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import type { CellOrigin, CellValue } from "@/lib/types";

export interface CellProps {
  row: number;
  col: number;
  value: CellValue;
  origin: CellOrigin;
  /** The cell the caret is on. */
  isSelected: boolean;
  /** Shares a row, column or box with the selected cell. */
  isPeer: boolean;
  /** Holds the same digit as the selected cell. */
  isMatching: boolean;
  /** Duplicates a digit in its row, column or box. */
  isConflict: boolean;
  /** True once the board is solved, when input is refused. */
  locked: boolean;
  /**
   * Stagger for the solve reveal, in milliseconds, or `null` when no reveal is
   * running. Null rather than 0 so the first cell, whose delay is 0, still
   * animates with its neighbours.
   */
  revealDelay: number | null;
  /**
   * Bumped on each solve. Feeds the digit's React key so the animation
   * restarts even when the same digit lands in the same cell twice.
   */
  revealToken: number;
  onSelect: (row: number, col: number) => void;
}

/**
 * One square of the board.
 *
 * A button rather than an `<input>`: the board takes digits from a window-level
 * key handler and from the on-screen pad, so 81 live text inputs would buy
 * nothing but layout cost, mobile keyboard pop-ups and styling fights.
 *
 * Memoised on primitive props, and every handler passed in is referentially
 * stable, so moving the selection re-renders the handful of cells whose
 * highlight actually changed rather than all 81.
 */
function CellComponent({
  row,
  col,
  value,
  origin,
  isSelected,
  isPeer,
  isMatching,
  isConflict,
  locked,
  revealDelay,
  revealToken,
  onSelect,
}: CellProps) {
  const isRevealing = revealDelay !== null;

  const label = `Row ${row + 1}, column ${col + 1}, ${
    value === 0 ? "empty" : value
  }${origin === "solved" ? ", solved" : ""}${isConflict ? ", conflict" : ""}`;

  return (
    <button
      type="button"
      // Roving tabindex: exactly one cell is ever in the tab order.
      tabIndex={isSelected || (row === 0 && col === 0) ? 0 : -1}
      aria-label={label}
      aria-pressed={isSelected}
      data-row={row}
      data-col={col}
      onClick={() => onSelect(row, col)}
      className={cn(
        "relative flex aspect-square items-center justify-center",
        "font-mono tabular-nums leading-none transition-colors duration-150",
        "text-[6.4cqw] sm:text-[6cqw]",
        locked ? "cursor-default" : "cursor-pointer",

        // Background, most specific state first.
        isConflict
          ? "bg-danger/12"
          : isSelected
            ? "bg-accent/14"
            : isMatching
              ? "bg-panel-hi"
              : isPeer
                ? "bg-panel-peer"
                : "bg-panel",

        !locked && !isSelected && "hover:bg-panel-hi",

        // Colour separates solver output from what the user typed; weight
        // repeats the distinction so it survives a colour-blind reading.
        isConflict
          ? "text-danger"
          : origin === "solved"
            ? "text-solved"
            : "text-ink",
        origin === "given" ? "font-semibold" : "font-normal",

        isSelected &&
          "z-10 ring-2 ring-accent shadow-[0_0_18px_-2px_var(--color-accent)] ring-inset",
        isMatching && !isSelected && "ring-1 ring-accent/25 ring-inset",
      )}
    >
      {value !== 0 && (
        <span
          // Remounting on any of these restarts the CSS animation.
          key={`${revealToken}-${value}-${origin}`}
          className={cn(
            "inline-block",
            isConflict
              ? "animate-nudge"
              : isRevealing
                ? "animate-reveal"
                : "animate-pop",
          )}
          style={isRevealing ? { animationDelay: `${revealDelay}ms` } : undefined}
        >
          {value}
        </span>
      )}
    </button>
  );
}

export const Cell = memo(CellComponent);
