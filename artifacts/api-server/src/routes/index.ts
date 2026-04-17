import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import analyticsRouter from "./analytics.js";
import forecastRouter from "./forecast.js";
import authRouter from "./auth.js";
import integrationsRouter from "./integrations.js";
import oauthRouter from "./oauth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/analytics", analyticsRouter);
router.use("/forecast", forecastRouter);
router.use("/auth", authRouter);
router.use("/integrations", integrationsRouter);
router.use("/oauth", oauthRouter);

export default router;
