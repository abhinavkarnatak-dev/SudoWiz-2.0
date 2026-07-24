"use client";

import { cn } from "@/lib/cn";
import type { Notice, SolveStats } from "@/hooks/useSudoku";

interface StatusBarProps {
  notice: Notice | null;
  stats: SolveStats | null;
  filledCount: number;
  conflictCount: number;
}

const TONE_STYLES = {
  info: "text-ink-dim ring-white/8 bg-panel/60",
  success: "text-solved ring-solved/25 bg-solved/8",
  error: "text-danger ring-danger/25 bg-danger/8",
} as const;

const TONE_DOT = {
  info: "bg-ink-faint",
  success: "bg-solved",
  error: "bg-danger",
} as const;

/**
 * Feedback line under the board.
 *
 * Height is reserved whether or not a message is showing, so the board and
 * controls never shift when one arrives. Replaces the original's `alert()`
 * calls, which blocked the page and lost the reference to the offending cell.
 */
export function StatusBar({
  notice,
  stats,
  filledCount,
  conflictCount,
}: StatusBarProps) {
  return (
    <div className="min-h-11">
      {notice ? (
        <div
          key={notice.id}
          role="status"
          aria-live="polite"
          className={cn(
            "animate-rise flex items-center gap-2.5 rounded-xl px-3.5 py-2.5",
            "text-sm ring-1 ring-inset",
            TONE_STYLES[notice.tone],
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              TONE_DOT[notice.tone],
            )}
            aria-hidden="true"
          />
          <span className="leading-snug">{notice.text}</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-1 py-3 font-mono text-[11px] tracking-wide text-ink-faint">
          <span>{filledCount}/81 filled</span>
          {conflictCount > 0 && (
            <span className="text-danger">{conflictCount} conflicting</span>
          )}
          {stats && (
            <>
              <span aria-hidden="true">·</span>
              <span>{stats.ms} ms</span>
              <span aria-hidden="true">·</span>
              <span>{stats.steps.toLocaleString()} steps</span>
              {!stats.unique && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-accent">multiple solutions</span>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
