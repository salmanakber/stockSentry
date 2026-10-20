"use client";

import { useEffect } from "react";
import { useReducedMotion } from "./useReducedMotion";

function countUp(el: HTMLElement, reduced: boolean) {
  const n = Number(el.dataset.n);
  if (!Number.isFinite(n)) return;
  let t0: number | null = null;
  const frame = (t: number) => {
    if (t0 === null) t0 = t;
    const p = reduced ? 1 : Math.min((t - t0) / 1700, 1);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.round(n * e).toLocaleString("en-US");
    if (p < 1) requestAnimationFrame(frame);
  };
  window.setTimeout(() => requestAnimationFrame(frame), 400);
}

function reveal(el: Element, reduced: boolean) {
  const node = el as HTMLElement;
  window.setTimeout(() => node.classList.add("done"), 1700);
  node.classList.add("in");
  node.querySelectorAll<HTMLElement>("[data-n]").forEach((n) =>
    countUp(n, reduced),
  );
  if (node.dataset.n) countUp(node, reduced);
}

/**
 * Observe `.rv` elements under `root` (or document) and reveal on intersect.
 * Re-runs when `deps` change so newly mounted cards animate.
 */
export function useReveal(
  enabled: boolean,
  root?: HTMLElement | null,
  deps: unknown[] = [],
) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!enabled) return;
    const scope = root ?? document;
    const nodes = Array.from(scope.querySelectorAll(".rv:not(.in)"));
    if (!nodes.length) return;

    if (!("IntersectionObserver" in window)) {
      nodes.forEach((el) => reveal(el, reduced));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target, reduced);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    nodes.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, root, reduced, ...deps]);
}
