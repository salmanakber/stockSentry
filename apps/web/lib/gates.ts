/** Dispatched after plan selection or onboarding complete so the app layout re-checks gates. */
export const GATES_REFRESH_EVENT = "ss:gates-refresh";

export function refreshAppGates(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(GATES_REFRESH_EVENT));
  }
}
