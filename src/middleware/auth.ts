import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Admin, IAdmin } from "../models/Admin";

export interface AuthRequest extends Request {
  adminId?: string;
  admin?: IAdmin;
}

export const ADMIN_COOKIE_NAME = "nsi_admin_session";

/**
 * Extracts JWT from either:
 * 1. Bearer token in Authorization header
 * 2. HttpOnly cookie (nsi_admin_session)
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1]?.trim();
    if (token) return token;
  }

  if (req.cookies && req.cookies[ADMIN_COOKIE_NAME]) {
    return req.cookies[ADMIN_COOKIE_NAME];
  }

  return null;
}

/**
 * Server-side authentication guard.
 * Validates JWT, verifies admin existence and active status in MongoDB,
 * and attaches verified admin instance to req.admin and req.adminId.
 */
export async function protect(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: "Server misconfiguration" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { id: string; role?: string };
    
    // Look up the admin in DB to guarantee active status and prevent revoked sessions
    const admin = await Admin.findById(payload.id);
    if (!admin) {
      res.status(401).json({ message: "Admin account no longer exists" });
      return;
    }

    if (!admin.isActive) {
      res.status(403).json({ message: "Admin account is disabled" });
      return;
    }

    req.adminId = admin._id.toString();
    req.admin = admin;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      res.status(401).json({ message: "Session expired, please sign in again" });
      return;
    }
    res.status(401).json({ message: "Invalid authentication credentials" });
  }
}

/**
 * Role-based authorization middleware (superadmin vs admin)
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    if (!roles.includes(req.admin.role)) {
      res.status(403).json({ message: "Access forbidden: insufficient administrator permissions" });
      return;
    }
    next();
  };
}
