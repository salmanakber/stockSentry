"use client";

import { useSearchParams } from "next/navigation";

/** Design QA only — `?demo=1` loads sample data and shows the Sample data tag. */
export function useDemoMode(): boolean {
  const params = useSearchParams();
  return params.get("demo") === "1";
}
