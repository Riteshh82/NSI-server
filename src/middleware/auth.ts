import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  adminId?: string;
}

export function protect(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // JWT_SECRET is validated at startup; this is a last-resort guard
    res.status(500).json({ message: "Server misconfiguration" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { id: string };
    req.adminId = payload.id;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
