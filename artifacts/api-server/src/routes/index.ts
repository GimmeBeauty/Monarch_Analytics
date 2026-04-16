import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import analyticsRouter from "./analytics.js";
import forecastRouter from "./forecast.js";
import authRouter from "./auth.js";
import integrationsRouter from "./integrations.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/analytics", analyticsRouter);
router.use("/forecast", forecastRouter);
router.use("/auth", authRouter);
router.use("/integrations", integrationsRouter);

export default router;
