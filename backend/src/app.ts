import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { adminRouter } from "./routes/admin.js";
import { deferralsRouter } from "./routes/deferrals.js";
import { meRouter } from "./routes/me.js";
import { paymentsRouter } from "./routes/payments.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { authenticateTelegram } from "./auth/middleware.js";
import { logger } from "./lib/logger.js";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", true);
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value
  );

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/webhooks", webhooksRouter);

  app.use("/api", authenticateTelegram);
  app.use("/api/me", meRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/deferrals", deferralsRouter);
  app.use("/api/admin", adminRouter);

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    logger.error("request_failed", {
      message: error instanceof Error ? error.message : String(error)
    });

    res.status(400).json({
      error: error instanceof Error ? error.message : "Bad request"
    });
  };

  app.use(errorHandler);

  return app;
};
