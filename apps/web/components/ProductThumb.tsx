"use client";

interface ProductThumbProps {
  src?: string | null;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function initials(label?: string): string {
  const parts = (label ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function ProductThumb({
  src,
  label,
  size = "md",
  className = "",
}: ProductThumbProps) {
  return (
    <span className={`prod-thumb prod-thumb-${size} ${className}`.trim()}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" />
      ) : (
        <span aria-hidden>{initials(label)}</span>
      )}
    </span>
  );
}
