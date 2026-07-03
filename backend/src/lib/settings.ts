import { prisma } from "./prisma.js";

export const getSettings = () =>
  prisma.settings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" }
  });
