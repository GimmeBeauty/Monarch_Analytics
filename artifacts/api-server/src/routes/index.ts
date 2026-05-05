import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import analyticsRouter from "./analytics.js";
import forecastRouter from "./forecast.js";
import authRouter from "./auth.js";
import integrationsRouter from "./integrations.js";
import oauthRouter from "./oauth.js";
import dataRouter from "./data.js";
import netsuiteRouter from "./netsuite.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/analytics", analyticsRouter);
router.use("/forecast", forecastRouter);
router.use("/auth", authRouter);
router.use("/integrations", integrationsRouter);
router.use("/oauth", oauthRouter);
router.use("/data", dataRouter);
router.use("/auth/netsuite", netsuiteRouter);

export default router;
