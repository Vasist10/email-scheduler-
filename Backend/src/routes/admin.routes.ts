import { Router } from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "../queues/email.queue";
import { adminAuth } from "../middlewares/adminAuth.middleware";

/**
 * Bull-board admin dashboard
 *
 * Mounted at /admin/queues in server.ts.
 * Protected by HTTP Basic Auth (ADMIN_USER / ADMIN_PASSWORD env vars).
 *
 * The dashboard shows all five job states for the email queue:
 *   - Waiting   – jobs queued and not yet picked up by a worker
 *   - Delayed   – jobs scheduled to run at a future time
 *   - Active    – jobs currently being processed by a worker
 *   - Completed – jobs that finished successfully (last 500 kept)
 *   - Failed    – jobs that exhausted all retry attempts (last 500 kept)
 */

// 1. Create the Express adapter — this becomes the Express router
const serverAdapter = new ExpressAdapter();

// 2. Set the base path so bull-board resolves its assets correctly.
//    Must match the mount point used in server.ts.
serverAdapter.setBasePath("/admin/queues");

// 3. Register the queues you want to expose on the dashboard
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

// 4. Export the router; server.ts mounts it at /admin/queues
const adminRouter = Router();

// Apply basic-auth guard to every request under this router
adminRouter.use(adminAuth);

// Hand all requests to the bull-board adapter
adminRouter.use("/", serverAdapter.getRouter());

export default adminRouter;
