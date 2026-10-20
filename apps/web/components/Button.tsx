"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary";
  children: ReactNode;
}

export function Button({
  variant = "default",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const classes = ["btn", variant === "primary" ? "p" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
