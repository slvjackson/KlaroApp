import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import uploadsRouter from "./uploads";
import parsedRecordsRouter from "./parsed-records";
import transactionsRouter from "./transactions";
import insightsRouter from "./insights";
import dashboardRouter from "./dashboard";
import chatRouter from "./chat";
import billingRouter from "./billing";
import { requireAuth } from "../middlewares/auth";
import { requireSubscription } from "../middlewares/subscription";

const router: IRouter = Router();

// Public routes — no auth or subscription required
router.use(healthRouter);
router.use(authRouter);
router.use(billingRouter);

// Protected routes — auth + active subscription required
const appRouter = Router();
appRouter.use(requireAuth);
appRouter.use(requireSubscription);
appRouter.use(uploadsRouter);
appRouter.use(parsedRecordsRouter);
appRouter.use(transactionsRouter);
appRouter.use(insightsRouter);
appRouter.use(dashboardRouter);
appRouter.use(chatRouter);

router.use(appRouter);

export default router;
