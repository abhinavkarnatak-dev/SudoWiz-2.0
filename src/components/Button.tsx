"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "quiet";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: cn(
    "bg-accent text-canvas font-semibold",
    "shadow-[0_10px_28px_-12px_var(--color-accent)]",
    "hover:bg-accent/90 active:translate-y-px",
  ),
  ghost: cn(
    "bg-panel text-ink ring-1 ring-white/8 ring-inset",
    "hover:bg-panel-hi hover:text-ink active:translate-y-px",
  ),
  quiet: cn(
    "bg-transparent text-ink-dim ring-1 ring-white/6 ring-inset",
    "hover:text-ink hover:bg-panel active:translate-y-px",
  ),
};

export function Button({
  variant = "ghost",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl",
        "px-4 py-2.5 text-sm tracking-wide transition-all duration-150",
        "disabled:pointer-events-none disabled:opacity-35",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
