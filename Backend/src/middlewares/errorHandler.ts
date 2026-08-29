import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  console.error("[Error]", err.stack ?? err.message);

  res.status(500).json({
    message: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  });
};
