/** Hidden SVG symbol defs from Bundle Safety dashboard design. */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <symbol id="ov" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </symbol>
        <symbol id="in" viewBox="0 0 24 24">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
        </symbol>
        <symbol id="hi" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </symbol>
        <symbol id="pr" viewBox="0 0 24 24">
          <path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" />
        </symbol>
        <symbol id="bu" viewBox="0 0 24 24">
          <path d="M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </symbol>
        <symbol id="ex" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </symbol>
        <symbol id="no" viewBox="0 0 24 24">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </symbol>
        <symbol id="se" viewBox="0 0 24 24">
          <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
        </symbol>
        <symbol id="he" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
        </symbol>
        <symbol id="sh" viewBox="0 0 24 24">
          <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
          <path d="m9 12 2 2 4-4" />
        </symbol>
        <symbol id="zp" viewBox="0 0 24 24">
          <path d="M13 2 3 14h9l-1 8 10-12h-9z" />
        </symbol>
        <symbol id="db" viewBox="0 0 24 24">
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </symbol>
        <symbol id="sc" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </symbol>
        <symbol id="rf" viewBox="0 0 24 24">
          <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12A9 9 0 0 1 18.5 5.8L21 8M21 3v5h-5M3 21v-5h5" />
        </symbol>
        <symbol id="ch" viewBox="0 0 24 24">
          <path d="m9 6 6 6-6 6" />
        </symbol>
        <symbol id="cl" viewBox="0 0 24 24">
          <path d="m15 6-6 6 6 6" />
        </symbol>
        <symbol id="mn" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </symbol>
      </defs>
    </svg>
  );
}

export function Icon({
  id,
  className = "i",
}: {
  id: string;
  className?: string;
}) {
  return (
    <svg className={className} aria-hidden>
      <use href={`#${id}`} />
    </svg>
  );
}
