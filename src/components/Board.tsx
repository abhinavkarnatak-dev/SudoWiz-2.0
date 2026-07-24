"use client";

import { useEffect, useRef } from "react";
import { Cell } from "./Cell";
import { BOX, SIZE, boxIndex, cellKey } from "@/lib/grid";
import { cn } from "@/lib/cn";
import type { RevealMode } from "@/hooks/useSudoku";
import type { CellRef, Grid, OriginGrid } from "@/lib/types";

export interface BoardProps {
  values: Grid;
  origins: OriginGrid;
  selected: CellRef | null;
  /** `"row,col"` keys of every cell taking part in a duplicate. */
  conflicts: Set<string>;
  locked: boolean;
  revealToken: number;
  /** Which cells play the staggered fill animation, if any. */
  reveal: RevealMode;
  onSelect: (row: number, col: number) => void;
}

/** Milliseconds between successive diagonals of the solve reveal. */
const REVEAL_STEP = 20;

/**
 * The 9x9 board.
 *
 * Rendered as three nested grids: board wrapper, nine 3x3 blocks, nine cells
 * each. The block and cell gaps let the wrapper's background show through, so
 * every rule line is a real hairline at any zoom instead of a stack of borders
 * that double up and drift.
 */
export function Board({
  values,
  origins,
  selected,
  conflicts,
  locked,
  revealToken,
  reveal,
  onSelect,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);

  // Arrow keys move the selection in state; the DOM focus has to follow it so
  // the focus ring and the highlight never disagree.
  //
  // Looked up from the DOM rather than through per-cell ref callbacks: an
  // inline `ref` arrow is a new prop value on every render, which would defeat
  // the `memo` on all 81 cells.
  useEffect(() => {
    if (!selected) {
      // Deselecting has to take the focus ring with it. Clicking a plain,
      // non-focusable area of the page leaves focus parked on the old cell,
      // which would otherwise still look picked.
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active.hasAttribute("data-row") &&
        boardRef.current?.contains(active)
      ) {
        active.blur();
      }
      return;
    }

    boardRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-row="${selected.row}"][data-col="${selected.col}"]`,
      )
      ?.focus({ preventScroll: true });
  }, [selected]);

  const selectedValue =
    selected === null ? 0 : values[selected.row][selected.col];

  return (
    <div
      ref={boardRef}
      role="group"
      aria-label="Sudoku board"
      // Presses inside the board pick a cell rather than clicking away.
      data-keeps-selection=""
      className={cn(
        "w-full rounded-board bg-rule-strong p-[3px]",
        "[container-type:inline-size] select-none overflow-hidden",
        "shadow-[0_28px_70px_-30px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.04)]",
        reveal === "solved" && "animate-flash",
      )}
    >
      <div className="grid grid-cols-3 gap-[3px]">
        {Array.from({ length: SIZE }, (_, block) => (
          <div key={block} className="grid grid-cols-3 gap-px bg-rule-soft">
            {Array.from({ length: SIZE }, (_, index) => {
              const row = Math.floor(block / BOX) * BOX + Math.floor(index / BOX);
              const col = (block % BOX) * BOX + (index % BOX);
              const value = values[row][col];
              const origin = origins[row][col];
              // Only the cells the current reveal is about should stagger:
              // after a solve the givens were already on screen.
              const shouldReveal = value !== 0 && origin === reveal;

              const isSelected =
                selected !== null &&
                selected.row === row &&
                selected.col === col;

              const isPeer =
                selected !== null &&
                !isSelected &&
                (selected.row === row ||
                  selected.col === col ||
                  boxIndex(selected.row, selected.col) === boxIndex(row, col));

              return (
                <Cell
                  // A block spans three rows, so `col` alone repeats.
                  key={cellKey(row, col)}
                  row={row}
                  col={col}
                  value={value}
                  origin={origin}
                  isSelected={isSelected}
                  isPeer={isPeer}
                  isMatching={
                    !isSelected && value !== 0 && value === selectedValue
                  }
                  isConflict={conflicts.has(cellKey(row, col))}
                  locked={locked}
                  revealToken={revealToken}
                  revealDelay={shouldReveal ? (row + col) * REVEAL_STEP : null}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
