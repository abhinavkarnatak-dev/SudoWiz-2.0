"use client";

import { PUZZLES } from "@/lib/puzzles";
import { cn } from "@/lib/cn";
import type { Puzzle } from "@/lib/types";

interface PuzzleMenuProps {
  onLoad: (puzzle: Puzzle) => void;
}

/**
 * One-tap sample puzzles, so the tool is usable without hunting for a grid.
 * Stays live while a solution is on screen: loading a sample replaces the board
 * and drops back to editing, which is what a second click is asking for anyway.
 */
export function PuzzleMenu({ onLoad }: PuzzleMenuProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
        Samples
      </span>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {PUZZLES.map((puzzle) => (
          <button
            key={puzzle.id}
            type="button"
            onClick={() => onLoad(puzzle)}
            className={cn(
              "rounded-lg px-3 py-1.5 font-mono text-xs tracking-wide",
              "bg-panel/70 text-ink-dim ring-1 ring-white/6 ring-inset",
              "transition-all duration-150",
              "hover:bg-panel-hi hover:text-accent hover:ring-accent/35",
              "active:translate-y-px",
            )}
          >
            {puzzle.label}
          </button>
        ))}
      </div>
    </div>
  );
}
