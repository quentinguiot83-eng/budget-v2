/** Both the separate public demo deployment and the internal ?demo=1 preview are offline. */
export const DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === "1" ||
  new URLSearchParams(window.location.search).get("demo") === "1";
