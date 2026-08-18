export type Theme = "light" | "dark";

/** Monarch Mode (light): orange/gold. Gimme Mode (dark): purple/blue. */
export function brandGradient(theme: Theme) {
  return theme === "dark"
    ? "linear-gradient(135deg, #BFA1E3, #9BDBF3)"
    : "linear-gradient(135deg, #FFBC80, #FFE29A)";
}
