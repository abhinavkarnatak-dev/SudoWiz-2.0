"use client";

import { useCallback, useEffect } from "react";
import { Board } from "./Board";
import { ScanControl } from "./ScanControl";
import { Controls } from "./Controls";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { KeyboardHints } from "./KeyboardHints";
import { NumberPad } from "./NumberPad";
import { PuzzleMenu } from "./PuzzleMenu";
import { StatusBar } from "./StatusBar";
import { cn } from "@/lib/cn";
import { useScan } from "@/hooks/useScan";
import { useSudoku } from "@/hooks/useSudoku";
import type { Digit } from "@/lib/types";

/** How long a non-error message stays up before fading itself out. */
const NOTICE_TTL_MS = 5000;

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

export function SudokuApp() {
  const {
    values,
    origins,
    selected,
    phase,
    notice,
    stats,
    reveal,
    revealToken,
    conflicts,
    digitCounts,
    filledCount,
    canUndo,
    isEmpty,
    actions,
  } = useSudoku();

  const isSolved = phase === "solved";

  const { scan, isScanning } = useScan({
    onStart: actions.scanStart,
    onSuccess: useCallback(
      (cells: string) => actions.scanApply(cells),
      [actions],
    ),
    onError: useCallback(
      (message: string) => actions.scanFail(message),
      [actions],
    ),
  });

  // Errors stay until the user does something about them; everything else
  // clears itself so the stats line can come back.
  useEffect(() => {
    if (!notice || notice.tone === "error") return;
    const timer = window.setTimeout(actions.dismissNotice, NOTICE_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [notice, actions]);

  // Pressing anywhere outside the board drops the selection. `pointerdown`
  // rather than `click` so it also fires for touch and for presses that never
  // resolve into a click, such as a drag onto the scan panel.
  useEffect(() => {
    if (!selected) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Dragging the crop box is not clicking away from the board.
      if (target.closest("[data-blocking-modal]")) return;
      // The board owns selection, and the number pad acts on it. Everything
      // else - controls, samples, scan, the page background - clears it.
      if (target.closest("[data-keeps-selection]")) return;
      actions.deselect();
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [selected, actions]);

  // Bound on the window rather than the board so typing still works right after
  // clicking Solve or a sample, when focus is sitting on a control.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Only bail for real text entry. A file input is not text entry, and the
      // hidden one behind the scan button used to swallow every key here.
      if (
        (target instanceof HTMLInputElement && target.type !== "file") ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        actions.undo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      // The cropper covers the board. Typing while it is open must not reach
      // the grid underneath; it handles its own Escape.
      if (document.querySelector("[data-blocking-modal]")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        actions.deselect();
        return;
      }

      const arrow = ARROWS[event.key];
      if (arrow) {
        event.preventDefault();
        actions.moveSelection(arrow[0], arrow[1]);
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        actions.setDigit(Number(event.key) as Digit);
        return;
      }

      if (
        event.key === "Backspace" ||
        event.key === "Delete" ||
        event.key === "0"
      ) {
        event.preventDefault();
        actions.clearCell();
        return;
      }

      // Enter on a focused control is that control's job, not ours. A grid cell
      // is a button too, but selecting it is what the click already did, so
      // Enter there should still mean solve.
      if (event.key === "Enter") {
        const isControl =
          target instanceof HTMLButtonElement && !target.hasAttribute("data-row");
        const isLink = target instanceof HTMLAnchorElement;
        if (isControl || isLink) return;

        event.preventDefault();
        if (isSolved) actions.clearSolution();
        else actions.solve();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, isSolved]);

  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-8 sm:py-12",
        // Stacked on phones and tablets. From lg the page splits into board and
        // sidebar: a single centred column leaves a laptop mostly empty margin,
        // and the controls have to sit below the fold to reach them.
        "lg:max-w-5xl lg:gap-6",
      )}
    >
      <Header />

      <div
        className={cn(
          "flex flex-col gap-5",
          "lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8",
        )}
      >
        <div className="flex flex-col gap-5">
          {/* Capped so the grid stays a comfortable reading size on a wide
              screen rather than stretching to fill the column. */}
          <div className="mx-auto w-full max-w-[34rem]">
            <Board
              values={values}
              origins={origins}
              selected={selected}
              conflicts={conflicts}
              locked={isSolved}
              revealToken={revealToken}
              reveal={reveal}
              onSelect={actions.select}
            />
          </div>

          <StatusBar
            notice={notice}
            stats={stats}
            filledCount={filledCount}
            conflictCount={conflicts.size}
          />
        </div>

        <div className="flex flex-col gap-5">
          <Controls
            phase={phase}
            canUndo={canUndo}
            isEmpty={isEmpty}
            onSolve={actions.solve}
            onClearSolution={actions.clearSolution}
            onUndo={actions.undo}
            onReset={actions.reset}
          />

          <NumberPad
            digitCounts={digitCounts}
            disabled={isSolved}
            onDigit={actions.setDigit}
            onErase={actions.clearCell}
          />

          <div className="mt-1 flex flex-col gap-4 border-t border-white/6 pt-5">
            <ScanControl isScanning={isScanning} onFile={scan} />
            <PuzzleMenu onLoad={actions.loadPuzzle} />
            <KeyboardHints />
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
