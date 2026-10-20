import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  loading?: boolean;
  hover?: boolean;
  reveal?: boolean;
}

export function Card({
  children,
  className = "",
  style,
  loading = false,
  hover = false,
  reveal = true,
}: CardProps) {
  const classes = [
    "card",
    hover ? "hv" : "",
    reveal ? "rv" : "",
    loading ? "ld" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}

export function CardTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ct">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
