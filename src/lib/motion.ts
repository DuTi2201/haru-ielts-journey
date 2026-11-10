/** True when the learner asked their device for less motion. Guarded so it is
 * safe during server rendering and in browsers without matchMedia. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
