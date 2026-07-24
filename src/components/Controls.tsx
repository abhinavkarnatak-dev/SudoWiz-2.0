"use client";

import { Button } from "./Button";
import type { Phase } from "@/hooks/useSudoku";

interface ControlsProps {
  phase: Phase;
  canUndo: boolean;
  isEmpty: boolean;
  onSolve: () => void;
  onClearSolution: () => void;
  onUndo: () => void;
  onReset: () => void;
}

export function Controls({
  phase,
  canUndo,
  isEmpty,
  onSolve,
  onClearSolution,
  onUndo,
  onReset,
}: ControlsProps) {
  const isSolved = phase === "solved";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isSolved ? (
        <Button variant="primary" onClick={onClearSolution} className="flex-1">
          <PencilIcon />
          Keep editing
        </Button>
      ) : (
        <Button variant="primary" onClick={onSolve} className="flex-1">
          <BoltIcon />
          Solve
        </Button>
      )}

      <Button variant="ghost" onClick={onUndo} disabled={!canUndo}>
        <UndoIcon />
        Undo
      </Button>

      <Button variant="quiet" onClick={onReset} disabled={isEmpty && !isSolved}>
        Reset
      </Button>
    </div>
  );
}

function BoltIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M13.5 2 4 13.2a.6.6 0 0 0 .46 1h5.3l-1.3 7.6a.6.6 0 0 0 1.05.48L20 11.05a.6.6 0 0 0-.46-1h-5.3l1.3-7.55A.6.6 0 0 0 13.5 2Z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 7v6h6" />
      <path d="M3.5 13a9 9 0 1 0 2.6-6.4L3 9.5" />
    </svg>
  );
}
