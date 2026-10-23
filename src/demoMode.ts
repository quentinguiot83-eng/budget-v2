/** The standalone public demo and the ?demo=1 preview never touch production data. */
export const DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === "1" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1");
