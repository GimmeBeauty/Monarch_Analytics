/**
 * Base URL for all API calls.
 *
 * Set VITE_API_BASE_URL when the frontend and API server are on different
 * origins (e.g. separate Replit services).
 *
 * Leave unset (or empty) when using the Vite dev proxy or a same-origin
 * production deployment.
 *
 * Example .env:
 *   VITE_API_BASE_URL=https://api-server-5000.nick.repl.co
 */
export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
