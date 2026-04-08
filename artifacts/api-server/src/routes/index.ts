import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyticsRouter from "./analytics";
import forecastRouter from "./forecast";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/analytics", analyticsRouter);
router.use("/forecast", forecastRouter);

export default router;
