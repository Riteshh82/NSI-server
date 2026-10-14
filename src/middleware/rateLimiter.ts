import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { AuditLog } from "../models/AuditLog";

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Audit log helper: Records security events without logging passwords, tokens, or OTPs
 */
export async function logSecurityEvent(params: {
  action: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "ACCOUNT_LOCKED" | "LOGOUT" | "SUSPICIOUS_ACCESS" | "PASSWORD_CHANGE";
  email?: string;
  ipAddress: string;
  userAgent?: string;
  status: "SUCCESS" | "FAILURE" | "BLOCKED";
  details?: string;
}): Promise<void> {
  try {
    await AuditLog.create({
      action: params.action,
      email: params.email?.toLowerCase().trim(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent?.slice(0, 300),
      status: params.status,
      details: params.details?.slice(0, 500),
    });
  } catch (err) {
    // Audit logging should not crash the request flow
    console.error("[AuditLog Error]", err);
  }
}

/**
 * Rate limiter for sensitive Admin Authentication endpoints (Login & verification)
 * 5 failed/total attempts per 15 minutes per IP address.
 */
export const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const email = req.body?.email ? String(req.body.email) : undefined;

    await logSecurityEvent({
      action: "SUSPICIOUS_ACCESS",
      email,
      ipAddress: ip,
      userAgent: req.headers["user-agent"],
      status: "BLOCKED",
      details: "Rate limit exceeded on admin authentication endpoint",
    });

    res.status(429).json({
      message: "Too many login attempts. For security reasons, please wait 15 minutes before trying again.",
      retryAfterMinutes: 15,
    });
  },
});
