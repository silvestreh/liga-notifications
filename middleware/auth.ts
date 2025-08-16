import { Request, Response, NextFunction } from "express";

// API Key Authentication Middleware
export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const apiKey =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace("Bearer ", "");
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    console.error("API_KEY environment variable not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }

  next();
};
