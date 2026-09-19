import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin";

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate admin and return JWT.
 * On first login, auto-seeds the admin account from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    // Find or auto-seed the admin account on first run
    let admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      const seedEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
      const seedPassword = process.env.ADMIN_PASSWORD ?? "";
      if (!seedEmail || !seedPassword || email.toLowerCase() !== seedEmail) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
      const hash = await bcrypt.hash(seedPassword, 12);
      admin = await Admin.create({ email: seedEmail, passwordHash: hash });
    }

    const isValid = await admin.comparePassword(password);
    if (!isValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const secret = process.env.JWT_SECRET!;
    const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
    const token = jwt.sign({ id: admin._id }, secret, { expiresIn } as jwt.SignOptions);

    res.json({
      token,
      admin: { id: admin._id, email: admin.email },
    });
  } catch (err) {
    // Re-throw to let the global error handler respond with 500
    throw err;
  }
});

export default router;
