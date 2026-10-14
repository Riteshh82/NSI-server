// ── Load env vars FIRST, before any other imports ────────────────────────────
// r2.ts reads process.env at module load time, so dotenv must run before import.
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { connectDB } from "./db";
import productRoutes from "./routes/products";
import categoryRoutes from "./routes/categories";
import bulkOrderRoutes from "./routes/bulkOrders";
import messageRoutes from "./routes/messages";
import authRoutes from "./routes/auth";
import settingsRoutes from "./routes/settings";
import uploadRoutes from "./routes/upload";
import newlyAddedRoutes from "./routes/newlyadded";
import heroBannerRoutes from "./routes/heroBanners";
import cookieParser from "cookie-parser";

// ── Startup validation ──────────────────────────────────────────────────────
if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined. Set it in your .env file.");
}
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined. Set it in your .env file.");
}

// R2 env var validation with actionable error messages
const r2Checks: Array<{ key: string; hint: string }> = [
  { key: "R2_ACCOUNT_ID",        hint: "Find it in Cloudflare Dashboard → R2 → right sidebar" },
  { key: "R2_ACCESS_KEY_ID",     hint: "Create at R2 → Manage R2 API Tokens → Create API Token" },
  { key: "R2_SECRET_ACCESS_KEY", hint: "Shown once when you create the API token" },
  { key: "R2_BUCKET_NAME",       hint: "The name of the R2 bucket you created" },
  {
    key: "R2_PUBLIC_BASE_URL",
    hint:
      "Go to your R2 bucket → Settings → Public access → Enable r2.dev subdomain. " +
      "Copy the URL shown (e.g. https://pub-xxxxx.r2.dev). " +
      "Or add a custom domain under Custom Domains.",
  },
];
for (const { key, hint } of r2Checks) {
  const val = process.env[key];
  if (!val || val.includes("yourdomain") || val.includes("<")) {
    throw new Error(
      `\n\n❌  ${key} is missing or still set to a placeholder value.\n` +
      `   Current value: "${val ?? "(not set)"}"\n` +
      `   How to fix  : ${hint}\n`
    );
  }
}

const app = express();
const PORT = process.env.PORT ?? 5000;

// ── CORS ────────────────────────────────────────────────────────────────────
const envOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  "https://nsi-preview.vercel.app",
  "http://localhost:5173",
  ...envOrigins
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin) and listed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ── Body & Cookie parsing ───────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Ensure DB Connection for Serverless ──────────────────────────────────────
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/bulk-orders", bulkOrderRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/newlyadded", newlyAddedRoutes);
app.use("/api/hero-banners", heroBannerRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message ?? "Internal server error" });
});

// ── Start (local dev only) ───────────────────────────────────────────────────
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\nNext Steel Innovation API running on http://localhost:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV ?? "development"}`);
    console.log(`   Health      : http://localhost:${PORT}/api/health\n`);
  });
}

start();

export default app;
