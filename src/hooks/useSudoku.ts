"use client";

import { useMemo, useReducer } from "react";
import {
  SIZE,
  cloneGrid,
  cloneOrigins,
  countDigits,
  countFilled,
  createEmptyGrid,
  createEmptyOrigins,
  gridFromString,
  isGridEmpty,
  isInBounds,
  originsFromGrid,
} from "@/lib/grid";
import { solveSudoku } from "@/lib/solver";
import { findConflictKeys } from "@/lib/validation";
import type {
  CellRef,
  CellValue,
  Digit,
  Grid,
  OriginGrid,
  Puzzle,
} from "@/lib/types";

/** `editing` accepts input; `solved` locks the board until the user clears it. */
export type Phase = "editing" | "solved";

/**
 * Which cells should play the staggered fill animation.
 * `solved` after a solve, `given` after a scan or sample load, `none` while
 * the user is typing, when a single popped digit reads better than a sweep.
 */
export type RevealMode = "none" | "solved" | "given";

export type NoticeTone = "info" | "success" | "error";

export interface Notice {
  /** Changes on every new notice so the banner can restart its animation. */
  id: number;
  tone: NoticeTone;
  text: string;
}

export interface SolveStats {
  steps: number;
  filled: number;
  unique: boolean;
  /** Wall-clock milliseconds, rounded to one decimal. */
  ms: number;
}

interface Snapshot {
  values: Grid;
  origins: OriginGrid;
  phase: Phase;
}

interface State {
  values: Grid;
  origins: OriginGrid;
  selected: CellRef | null;
  phase: Phase;
  notice: Notice | null;
  stats: SolveStats | null;
  reveal: RevealMode;
  /** Bumped on each reveal to replay the animation. */
  revealToken: number;
  history: Snapshot[];
  noticeSeq: number;
}

type Action =
  | { type: "select"; ref: CellRef }
  | { type: "deselect" }
  | { type: "moveSelection"; rowDelta: number; colDelta: number }
  | { type: "setDigit"; digit: Digit }
  | { type: "clearCell" }
  | { type: "solve" }
  | { type: "clearSolution" }
  | { type: "reset" }
  | { type: "loadPuzzle"; puzzle: Puzzle }
  | { type: "scanStart" }
  | { type: "scanApply"; cells: string }
  | { type: "scanFail"; message: string }
  | { type: "undo" }
  | { type: "dismissNotice" };

/** Deepest undo stack we keep. Snapshots are small, but unbounded growth is not. */
const HISTORY_LIMIT = 60;

function createInitialState(): State {
  return {
    values: createEmptyGrid(),
    origins: createEmptyOrigins(),
    selected: null,
    phase: "editing",
    notice: null,
    stats: null,
    reveal: "none",
    revealToken: 0,
    history: [],
    noticeSeq: 0,
  };
}

function snapshot(state: State): Snapshot {
  return {
    values: cloneGrid(state.values),
    origins: cloneOrigins(state.origins),
    phase: state.phase,
  };
}

function pushHistory(state: State): Snapshot[] {
  const next = [...state.history, snapshot(state)];
  return next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next;
}

function withNotice(state: State, tone: NoticeTone, text: string): Notice {
  return { id: state.noticeSeq + 1, tone, text };
}

/**
 * Replace one cell without cloning the whole board: only the touched row is a
 * new array, so rows that did not change keep their identity and memoised cells
 * in those rows skip re-rendering.
 */
function writeCell(grid: Grid, row: number, col: number, value: CellValue): Grid {
  if (grid[row][col] === value) return grid;
  const next = grid.slice();
  const nextRow = next[row].slice();
  nextRow[col] = value;
  next[row] = nextRow;
  return next;
}

function writeOrigin(
  origins: OriginGrid,
  row: number,
  col: number,
  value: OriginGrid[number][number],
): OriginGrid {
  if (origins[row][col] === value) return origins;
  const next = origins.slice();
  const nextRow = next[row].slice();
  nextRow[col] = value;
  next[row] = nextRow;
  return next;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "select": {
      const { row, col } = action.ref;
      if (!isInBounds(row, col)) return state;
      if (state.selected?.row === row && state.selected?.col === col) return state;
      return { ...state, selected: { row, col } };
    }

    case "deselect": {
      if (state.selected === null) return state;
      return { ...state, selected: null };
    }

    case "moveSelection": {
      const current = state.selected ?? { row: 0, col: 0 };
      // Wrap around the edges so arrow keys never dead-end.
      const row = (current.row + action.rowDelta + SIZE) % SIZE;
      const col = (current.col + action.colDelta + SIZE) % SIZE;
      return { ...state, selected: { row, col } };
    }

    case "setDigit": {
      if (state.phase === "solved") {
        return {
          ...state,
          noticeSeq: state.noticeSeq + 1,
          notice: withNotice(
            state,
            "info",
            "Board is locked. Clear the solution to keep editing.",
          ),
        };
      }
      // Tapping the pad before picking a cell is the obvious first move on a
      // phone, so say what is missing instead of doing nothing.
      if (!state.selected) {
        return {
          ...state,
          noticeSeq: state.noticeSeq + 1,
          notice: withNotice(state, "info", "Pick a cell on the board first."),
        };
      }

      const { row, col } = state.selected;
      // Pressing the digit already in the cell clears it, so one key toggles.
      const next: CellValue =
        state.values[row][col] === action.digit ? 0 : action.digit;

      const values = writeCell(state.values, row, col, next);
      if (values === state.values) return state;

      return {
        ...state,
        history: pushHistory(state),
        values,
        origins: writeOrigin(
          state.origins,
          row,
          col,
          next === 0 ? "empty" : "given",
        ),
        stats: null,
        notice: null,
        reveal: "none",
      };
    }

    case "clearCell": {
      if (state.phase === "solved" || !state.selected) return state;
      const { row, col } = state.selected;
      const values = writeCell(state.values, row, col, 0);
      if (values === state.values) return state;

      return {
        ...state,
        history: pushHistory(state),
        values,
        origins: writeOrigin(state.origins, row, col, "empty"),
        stats: null,
        notice: null,
        reveal: "none",
      };
    }

    case "solve": {
      if (state.phase === "solved") return state;

      if (isGridEmpty(state.values)) {
        return {
          ...state,
          noticeSeq: state.noticeSeq + 1,
          notice: withNotice(
            state,
            "info",
            "The board is empty. Type a puzzle in or load a sample below.",
          ),
        };
      }

      const startedAt = performance.now();
      const result = solveSudoku(state.values);
      const ms = Math.round((performance.now() - startedAt) * 10) / 10;

      if (result.status === "invalid") {
        return {
          ...state,
          noticeSeq: state.noticeSeq + 1,
          notice: withNotice(
            state,
            "error",
            `${result.conflicts.length} cells break a Sudoku rule. Fix the highlighted cells first.`,
          ),
        };
      }

      if (result.status === "unsolvable") {
        return {
          ...state,
          noticeSeq: state.noticeSeq + 1,
          notice: withNotice(
            state,
            "error",
            "No solution exists for this board. Check the numbers you entered.",
          ),
        };
      }

      if (result.status === "exhausted") {
        return {
          ...state,
          noticeSeq: state.noticeSeq + 1,
          notice: withNotice(
            state,
            "error",
            "The solver hit its search limit on this board. Try removing a few numbers.",
          ),
        };
      }

      if (result.filled.length === 0) {
        return {
          ...state,
          noticeSeq: state.noticeSeq + 1,
          notice: withNotice(state, "success", "That board was already solved."),
        };
      }

      // Cells the user typed stay `given`, everything the solver added is `solved`.
      const origins = state.origins.map((row, rowIndex) =>
        row.map((origin, colIndex) =>
          state.values[rowIndex][colIndex] === 0 ? "solved" : origin,
        ),
      );

      return {
        ...state,
        history: pushHistory(state),
        values: result.grid,
        origins,
        selected: null,
        phase: "solved",
        reveal: "solved",
        revealToken: state.revealToken + 1,
        stats: {
          steps: result.steps,
          filled: result.filled.length,
          unique: result.unique,
          ms,
        },
        noticeSeq: state.noticeSeq + 1,
        notice: withNotice(
          state,
          "success",
          result.unique
            ? `Solved ${result.filled.length} cells in ${ms} ms.`
            : `Solved in ${ms} ms. This board has more than one solution, so here is one of them.`,
        ),
      };
    }

    case "clearSolution": {
      if (state.phase !== "solved") return state;

      // Keep the user's own numbers, drop everything the solver wrote.
      const values = state.values.map((row, rowIndex) =>
        row.map((value, colIndex) =>
          state.origins[rowIndex][colIndex] === "solved"
            ? (0 as CellValue)
            : value,
        ),
      );
      const origins = state.origins.map((row) =>
        row.map((origin) => (origin === "solved" ? "empty" : origin)),
      );

      return {
        ...state,
        history: pushHistory(state),
        values,
        origins,
        phase: "editing",
        stats: null,
        notice: null,
        reveal: "none",
      };
    }

    case "reset": {
      const empty = createInitialState();
      return {
        ...empty,
        noticeSeq: state.noticeSeq,
        history: isGridEmpty(state.values) ? state.history : pushHistory(state),
      };
    }

    case "loadPuzzle": {
      const values = gridFromString(action.puzzle.cells);
      return {
        ...state,
        history: pushHistory(state),
        values,
        origins: originsFromGrid(values),
        selected: null,
        phase: "editing",
        stats: null,
        reveal: "given",
        revealToken: state.revealToken + 1,
        noticeSeq: state.noticeSeq + 1,
        notice: withNotice(
          state,
          "info",
          `Loaded the ${action.puzzle.label.toLowerCase()} sample. Hit Solve when you are ready.`,
        ),
      };
    }

    case "scanStart": {
      return {
        ...state,
        noticeSeq: state.noticeSeq + 1,
        notice: withNotice(state, "info", "Reading the grid from your photo..."),
      };
    }

    case "scanApply": {
      // The reducer runs during render, so a throw here would take the whole
      // tree down rather than surfacing as a message. Validate instead.
      let values: Grid;
      try {
        values = gridFromString(action.cells);
      } catch {
        return {
          ...state,
          noticeSeq: state.noticeSeq + 1,
          notice: withNotice(
            state,
            "error",
            "The scan came back in an unexpected shape. Try another photo.",
          ),
        };
      }

      const digits = countFilled(values);

      // A grid was detected but nothing was in it, which almost always means
      // the photo caught an empty or unreadable board.
      if (digits === 0) {
        return {
          ...state,
          noticeSeq: state.noticeSeq + 1,
          notice: withNotice(
            state,
            "error",
            "That grid came back empty. Try a sharper photo with the whole grid in frame.",
          ),
        };
      }

      // A misread digit usually shows up as a duplicate, so lead with that.
      const clashes = findConflictKeys(values).size;

      const message =
        clashes > 0
          ? `Scanned ${digits} digits, but ${clashes} of them clash. Fix the highlighted cells, then solve.`
          : `Scanned ${digits} digits. Give them a quick check, then hit Solve.`;

      return {
        ...state,
        history: pushHistory(state),
        values,
        origins: originsFromGrid(values),
        selected: null,
        phase: "editing",
        stats: null,
        reveal: "given",
        revealToken: state.revealToken + 1,
        noticeSeq: state.noticeSeq + 1,
        notice: withNotice(state, clashes > 0 ? "error" : "success", message),
      };
    }

    case "scanFail": {
      return {
        ...state,
        noticeSeq: state.noticeSeq + 1,
        notice: withNotice(state, "error", action.message),
      };
    }

    case "undo": {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return {
        ...state,
        history: state.history.slice(0, -1),
        values: previous.values,
        origins: previous.origins,
        phase: previous.phase,
        stats: null,
        notice: null,
        reveal: "none",
      };
    }

    case "dismissNotice":
      return state.notice === null ? state : { ...state, notice: null };

    default:
      return state;
  }
}

export function useSudoku() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  // Recomputed only when the board actually changes, not on selection moves.
  const conflicts = useMemo(() => findConflictKeys(state.values), [state.values]);
  const digitCounts = useMemo(() => countDigits(state.values), [state.values]);
  const filledCount = useMemo(() => countFilled(state.values), [state.values]);

  // Stable identities keep memoised cells from re-rendering on every keystroke.
  const actions = useMemo(
    () => ({
      select: (row: number, col: number) =>
        dispatch({ type: "select", ref: { row, col } }),
      deselect: () => dispatch({ type: "deselect" }),
      moveSelection: (rowDelta: number, colDelta: number) =>
        dispatch({ type: "moveSelection", rowDelta, colDelta }),
      setDigit: (digit: Digit) => dispatch({ type: "setDigit", digit }),
      clearCell: () => dispatch({ type: "clearCell" }),
      solve: () => dispatch({ type: "solve" }),
      clearSolution: () => dispatch({ type: "clearSolution" }),
      reset: () => dispatch({ type: "reset" }),
      loadPuzzle: (puzzle: Puzzle) => dispatch({ type: "loadPuzzle", puzzle }),
      scanStart: () => dispatch({ type: "scanStart" }),
      scanApply: (cells: string) => dispatch({ type: "scanApply", cells }),
      scanFail: (message: string) => dispatch({ type: "scanFail", message }),
      undo: () => dispatch({ type: "undo" }),
      dismissNotice: () => dispatch({ type: "dismissNotice" }),
    }),
    [],
  );

  return {
    ...state,
    conflicts,
    digitCounts,
    filledCount,
    canUndo: state.history.length > 0,
    isEmpty: filledCount === 0,
    actions,
  };
}
