import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db";
import productRoutes from "./routes/products";
import categoryRoutes from "./routes/categories";
import bulkOrderRoutes from "./routes/bulkOrders";
import messageRoutes from "./routes/messages";
import authRoutes from "./routes/auth";
import settingsRoutes from "./routes/settings";
import uploadRoutes from "./routes/upload";

dotenv.config();

// ── Startup validation ──────────────────────────────────────────────────────
if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined. Set it in your .env file.");
}
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined. Set it in your .env file.");
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

// ── Body parsing ─────────────────────────────────────────────────────────────
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
