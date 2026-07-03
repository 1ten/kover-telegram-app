import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { startEmbeddedBot, stopEmbeddedBot } from "./bot/runtime.js";

const app = createApp();
const server = app.listen(env.BACKEND_PORT, () => {
  logger.info("backend_started", { port: env.BACKEND_PORT });
});

if (env.START_BOT) {
  startEmbeddedBot().catch((error) => {
    logger.error("embedded_bot_start_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
  });
}

const shutdown = async () => {
  logger.info("backend_shutdown_started");
  await stopEmbeddedBot();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
