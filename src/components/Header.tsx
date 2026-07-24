export function Header() {
  return (
    <header className="flex items-center gap-3">
      <Mark />
      <div className="min-w-0">
        <h1 className="font-display text-lg leading-none font-semibold tracking-[0.14em] uppercase">
          Sudo<span className="text-accent">wiz</span>
        </h1>
        <p className="mt-1.5 font-mono text-[11px] leading-none text-ink-faint">
          Backtracking solver, entirely in your browser
        </p>
      </div>
    </header>
  );
}

/** 3x3 glyph echoing the board, with one amber cell as the accent. */
function Mark() {
  return (
    <svg
      viewBox="0 0 30 30"
      className="h-9 w-9 shrink-0"
      role="img"
      aria-label="Sudowiz"
    >
      <rect
        x="0.75"
        y="0.75"
        width="28.5"
        height="28.5"
        rx="7"
        fill="var(--color-panel)"
        stroke="var(--color-rule-strong)"
        strokeWidth="1.5"
      />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={7 + col * 5.5}
            y={7 + row * 5.5}
            width="3.4"
            height="3.4"
            rx="1"
            fill={
              row === 1 && col === 1
                ? "var(--color-accent)"
                : row === 0 && col === 2
                  ? "var(--color-solved)"
                  : "var(--color-ink-faint)"
            }
            opacity={row === 1 && col === 1 ? 1 : 0.75}
          />
        )),
      )}
    </svg>
  );
}
