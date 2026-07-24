interface Hint {
  keys: string[];
  /** Rendered between keys, e.g. "1 to 9". */
  joiner?: string;
  label: string;
}

const HINTS: Hint[] = [
  { keys: ["1", "9"], joiner: "to", label: "fill" },
  { keys: ["⌫"], label: "erase" },
  { keys: ["←", "↑", "↓", "→"], label: "move" },
  { keys: ["Enter"], label: "solve" },
  { keys: ["Esc"], label: "deselect" },
  { keys: ["Ctrl", "Z"], joiner: "+", label: "undo" },
];

/** Desktop-only affordance list. On touch the number pad already says it all. */
export function KeyboardHints() {
  return (
    <ul className="hidden flex-wrap items-center gap-x-4 gap-y-2 sm:flex">
      {HINTS.map((hint) => (
        <li
          key={hint.label}
          className="flex items-center gap-1.5 font-mono text-[11px] text-ink-faint"
        >
          {hint.keys.map((key, index) => (
            <span key={key} className="flex items-center gap-1.5">
              {index > 0 && hint.joiner && (
                <span className="text-ink-faint/60">{hint.joiner}</span>
              )}
              <kbd className="min-w-5 rounded-md bg-panel px-1.5 py-0.5 text-center text-ink-dim ring-1 ring-white/6 ring-inset">
                {key}
              </kbd>
            </span>
          ))}
          <span className="ml-0.5">{hint.label}</span>
        </li>
      ))}
    </ul>
  );
}
