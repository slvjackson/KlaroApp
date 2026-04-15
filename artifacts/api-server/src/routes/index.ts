import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import uploadsRouter from "./uploads";
import parsedRecordsRouter from "./parsed-records";
import transactionsRouter from "./transactions";
import insightsRouter from "./insights";
import dashboardRouter from "./dashboard";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(uploadsRouter);
router.use(parsedRecordsRouter);
router.use(transactionsRouter);
router.use(insightsRouter);
router.use(dashboardRouter);
router.use(chatRouter);

export default router;
