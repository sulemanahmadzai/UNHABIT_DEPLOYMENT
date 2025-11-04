import type { NextFunction, Request, Response } from "express";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);
  const status = err.status || 400;
  res.status(status).json({ error: err.message || "Something went wrong" });
}
