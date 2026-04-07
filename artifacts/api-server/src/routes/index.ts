import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/analytics", analyticsRouter);

export default router;
