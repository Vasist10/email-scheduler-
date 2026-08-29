import "dotenv/config";
import express from "express";
import cors from "cors";
import passport from "./config/passport";
import emailRoutes from "./routes/email.routes";
import authRoutes from "./routes/auth.routes";
import adminRouter from "./routes/admin.routes";
import slackRoutes from "./routes/slack.routes";
import { errorHandler } from "./middlewares/errorHandler";
import { env } from "./config/env";
import { recoverStuckEmails } from "./utils/recoverStuckEmails";
import { pingElasticsearch } from "./elasticsearch/client";
import { ensureEmailIndex } from "./elasticsearch/email.index";

const app = express();

// CORS — allow requests from the configured frontend origin
app.use(
  cors({
    origin: env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
app.use(passport.initialize());

// Routes
app.use("/api/emails", emailRoutes);
app.use("/auth", authRoutes);
app.use("/auth/slack", slackRoutes);
app.use("/admin/queues", adminRouter);

// Global error handler — must be registered last
app.use(errorHandler);

app.listen(env.PORT, async () => {
  console.log(`Server running on http://localhost:${env.PORT}`);

  // Reset any emails stuck in PROCESSING from a previous crashed run
  await recoverStuckEmails();

  // Elasticsearch startup: ping → create index if missing
  // Both steps are best-effort — failures log warnings but do not crash the server
  const esReachable = await pingElasticsearch();
  if (esReachable) {
    await ensureEmailIndex();
  }
});
