import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import * as React from "react";

export type ForgeButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement>
> & {
  variant?: "solid" | "ghost";
};

export function ForgeButton({
  variant = "solid",
  className,
  children,
  ...rest
}: ForgeButtonProps) {
  const classes = [
    "ff-button",
    variant === "ghost" ? "ff-button--ghost" : "ff-button--solid",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type="button" {...rest}>
      {children}
    </button>
  );
}
