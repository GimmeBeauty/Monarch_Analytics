import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import analyticsRouter from "./analytics.js";
import forecastRouter from "./forecast.js";
import authRouter from "./auth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/analytics", analyticsRouter);
router.use("/forecast", forecastRouter);
router.use("/auth", authRouter);

export default router;
