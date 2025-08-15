import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

// Device Authentication Middleware
// Expects a JWT token signed with DEVICE_SECRET that encodes the device's push token
// Header: X-Device-Auth: <jwt>   OR   Authorization: Bearer <jwt>
export const authenticateDevice = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const tokenHeader =
    (req.headers["x-device-auth"] as string) ||
    req.headers["authorization"]?.replace("Bearer ", "");

  if (!tokenHeader) {
    return res.status(401).json({ error: "Missing device auth token" });
  }

  const secret = process.env.DEVICE_SECRET;
  if (!secret) {
    console.error("DEVICE_SECRET environment variable not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const decoded = jwt.verify(tokenHeader, secret) as JwtPayload;
    const deviceToken = decoded.token as string | undefined;

    if (!deviceToken) {
      return res.status(401).json({ error: "Invalid device auth token" });
    }

    // Attach the decoded token to the request for downstream handlers
    (req as any).deviceToken = deviceToken;
    next();
  } catch (err) {
    console.warn("Device auth verification failed", err);
    return res.status(401).json({ error: "Invalid device auth token" });
  }
};
