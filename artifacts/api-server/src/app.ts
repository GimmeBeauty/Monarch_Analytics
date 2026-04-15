import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// ─── Trust proxy (for rate-limiter IP detection behind Replit/nginx) ──────────
app.set("trust proxy", 1);

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id:     req.id,
          method: req.method,
          url:    req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow requests from the frontend origin. When running behind a same-origin
// proxy (Vite dev proxy or nginx) the Origin header will match APP_URL.
const allowedOrigins = process.env.APP_URL
  ? [process.env.APP_URL, "http://localhost:3000", "http://localhost:5173"]
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // allow cookies
  }),
);

// ─── Body / Cookie Parsers ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
