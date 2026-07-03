import type { NextFunction, Request, Response } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncRoute =
  (handler: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
