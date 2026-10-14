import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin";
import { AuditLog } from "../models/AuditLog";
import { protect, AuthRequest, ADMIN_COOKIE_NAME } from "../middleware/auth";
import { adminAuthLimiter, getClientIp, logSecurityEvent } from "../middleware/rateLimiter";

const router = Router();

// Helper to set secure session cookie
function setAuthCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction, // Secure over HTTPS in production
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
}

function clearAuthCookie(res: Response) {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(ADMIN_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
  });
}

/**
 * POST /api/auth/login
 * Authenticate admin with rate limiting, brute-force cooldown, account lockout, and audit logging.
 */
router.post("/login", adminAuthLimiter, async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"];

  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ message: "Invalid request payload. Email and password are required." });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find or auto-seed the admin account on first run
    let admin = await Admin.findOne({ email: normalizedEmail });
    if (!admin) {
      const seedEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
      const seedPassword = process.env.ADMIN_PASSWORD ?? "";
      if (!seedEmail || !seedPassword || normalizedEmail !== seedEmail) {
        // Generic failure response to prevent user enumeration
        await logSecurityEvent({
          action: "LOGIN_FAILED",
          email: normalizedEmail,
          ipAddress: ip,
          userAgent,
          status: "FAILURE",
          details: "Non-existent admin email attempt",
        });
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }
      const hash = await bcrypt.hash(seedPassword, 12);
      admin = await Admin.create({
        email: seedEmail,
        passwordHash: hash,
        role: "superadmin",
        isActive: true,
      });
    }

    // Check if account is currently locked out
    if (admin.isLocked()) {
      const remainingMs = admin.lockUntil!.getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));

      await logSecurityEvent({
        action: "ACCOUNT_LOCKED",
        email: normalizedEmail,
        ipAddress: ip,
        userAgent,
        status: "BLOCKED",
        details: `Login attempted while locked. ${remainingMinutes}m remaining.`,
      });

      res.status(423).json({
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
        retryAfterMinutes: remainingMinutes,
      });
      return;
    }

    // Check if account is deactivated
    if (!admin.isActive) {
      await logSecurityEvent({
        action: "SUSPICIOUS_ACCESS",
        email: normalizedEmail,
        ipAddress: ip,
        userAgent,
        status: "BLOCKED",
        details: "Attempted login to disabled admin account",
      });
      res.status(403).json({ message: "Account has been deactivated. Contact an administrator." });
      return;
    }

    // Validate password
    const isValid = await admin.comparePassword(password);
    if (!isValid) {
      await admin.incrementFailedLogins();

      await logSecurityEvent({
        action: "LOGIN_FAILED",
        email: normalizedEmail,
        ipAddress: ip,
        userAgent,
        status: "FAILURE",
        details: `Incorrect password. Failed attempt #${admin.failedLoginAttempts + 1}`,
      });

      // Generic error response to prevent password inference
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    // Password is valid - reset lock counters and update last login
    await admin.resetFailedLogins(ip);

    const secret = process.env.JWT_SECRET!;
    const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      secret,
      { expiresIn } as jwt.SignOptions
    );

    // Set secure HttpOnly session cookie
    setAuthCookie(res, token);

    await logSecurityEvent({
      action: "LOGIN_SUCCESS",
      email: normalizedEmail,
      ipAddress: ip,
      userAgent,
      status: "SUCCESS",
    });

    res.json({
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
      },
    });
  } catch (err) {
    throw err;
  }
});

/**
 * POST /api/auth/logout
 * Securely clear server-side session cookie and record audit event
 */
router.post("/logout", protect, async (req: AuthRequest, res: Response) => {
  const ip = getClientIp(req);
  clearAuthCookie(res);

  if (req.admin) {
    await logSecurityEvent({
      action: "LOGOUT",
      email: req.admin.email,
      ipAddress: ip,
      userAgent: req.headers["user-agent"],
      status: "SUCCESS",
    });
  }

  res.json({ message: "Logged out successfully" });
});

/**
 * GET /api/auth/me
 * Server-side session verification.
 * Confirms that the current cookie or token is valid and returns admin profile.
 */
router.get("/me", protect, (req: AuthRequest, res: Response) => {
  res.json({
    admin: {
      id: req.admin!._id,
      email: req.admin!.email,
      role: req.admin!.role,
      lastLoginAt: req.admin!.lastLoginAt,
    },
  });
});

/**
 * GET /api/auth/audit-logs
 * Protected audit log endpoint for administrative security review
 */
router.get("/audit-logs", protect, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || "1"), 10);
    const limit = Math.min(50, parseInt(String(req.query.limit || "20"), 10));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(),
    ]);

    res.json({ logs, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve security audit logs" });
  }
});

export default router;
