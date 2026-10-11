import { Router, Request, Response, NextFunction } from "express";
import { HeroBanner } from "../models/HeroBanner";
import { protect } from "../middleware/auth";
import { deleteFromR2, keyFromUrl } from "../services/r2";

const router = Router();

// Helper to clean up R2 image if URL belongs to our bucket
async function safelyDeleteR2Image(url?: string, key?: string): Promise<void> {
  const targetKey = key || (url ? keyFromUrl(url) : undefined);
  if (targetKey) {
    await deleteFromR2(targetKey);
  }
}

// ── GET /api/hero-banners (Public) ───────────────────────────────────────────
// Returns active banners within scheduled display period, sorted by display order
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();

    const query: any = {
      status: "Active",
      $and: [
        {
          $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }],
        },
        {
          $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }],
        },
      ],
    };

    const banners = await HeroBanner.find(query).sort({ order: 1, createdAt: -1 }).lean();

    // Set cache headers: allow client/edge caching with short TTL and revalidation
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    res.json(banners);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/hero-banners/admin (Admin only) ─────────────────────────────────
// Returns all banners regardless of status or date
router.get("/admin", protect, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const banners = await HeroBanner.find().sort({ order: 1, createdAt: -1 });
    res.json(banners);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/hero-banners/:id (Admin only) ───────────────────────────────────
router.get("/:id", protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banner = await HeroBanner.findById(req.params.id);
    if (!banner) {
      res.status(404).json({ message: "Banner not found" });
      return;
    }
    res.json(banner);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/hero-banners (Admin only) ──────────────────────────────────────
router.post("/", protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      desktopImageUrl,
      mobileImageUrl,
      desktopImageKey,
      mobileImageKey,
      desktopMetadata,
      mobileMetadata,
      title,
      subtitle,
      ctaText,
      ctaUrl,
      order,
      status,
      startDate,
      endDate,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Banner name is required for internal identification." });
      return;
    }
    if (!desktopImageUrl || !desktopImageUrl.trim()) {
      res.status(400).json({ message: "Desktop banner image is required." });
      return;
    }
    if (!mobileImageUrl || !mobileImageUrl.trim()) {
      res.status(400).json({ message: "Mobile banner image is required." });
      return;
    }

    // Default order to current count + 1 if not explicitly provided
    let bannerOrder = typeof order === "number" ? order : 0;
    if (typeof order !== "number") {
      const count = await HeroBanner.countDocuments();
      bannerOrder = count;
    }

    const banner = new HeroBanner({
      name: name.trim(),
      desktopImageUrl: desktopImageUrl.trim(),
      mobileImageUrl: mobileImageUrl.trim(),
      desktopImageKey: desktopImageKey || keyFromUrl(desktopImageUrl) || "",
      mobileImageKey: mobileImageKey || keyFromUrl(mobileImageUrl) || "",
      desktopMetadata: desktopMetadata || {},
      mobileMetadata: mobileMetadata || {},
      title: (title || "").trim(),
      subtitle: (subtitle || "").trim(),
      ctaText: (ctaText || "").trim(),
      ctaUrl: (ctaUrl || "").trim(),
      order: bannerOrder,
      status: status === "Inactive" ? "Inactive" : "Active",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

    await banner.save();
    res.status(201).json(banner);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/hero-banners/:id (Admin only) ───────────────────────────────────
router.put("/:id", protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await HeroBanner.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: "Banner not found" });
      return;
    }

    const {
      name,
      desktopImageUrl,
      mobileImageUrl,
      desktopImageKey,
      mobileImageKey,
      desktopMetadata,
      mobileMetadata,
      title,
      subtitle,
      ctaText,
      ctaUrl,
      order,
      status,
      startDate,
      endDate,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Banner name is required." });
      return;
    }
    if (!desktopImageUrl || !desktopImageUrl.trim()) {
      res.status(400).json({ message: "Desktop banner image is required." });
      return;
    }
    if (!mobileImageUrl || !mobileImageUrl.trim()) {
      res.status(400).json({ message: "Mobile banner image is required." });
      return;
    }

    // If images were replaced, clean up the old image from R2
    if (existing.desktopImageUrl && existing.desktopImageUrl !== desktopImageUrl) {
      await safelyDeleteR2Image(existing.desktopImageUrl, existing.desktopImageKey);
    }
    if (existing.mobileImageUrl && existing.mobileImageUrl !== mobileImageUrl) {
      await safelyDeleteR2Image(existing.mobileImageUrl, existing.mobileImageKey);
    }

    existing.name = name.trim();
    existing.desktopImageUrl = desktopImageUrl.trim();
    existing.mobileImageUrl = mobileImageUrl.trim();
    existing.desktopImageKey = desktopImageKey || keyFromUrl(desktopImageUrl) || "";
    existing.mobileImageKey = mobileImageKey || keyFromUrl(mobileImageUrl) || "";

    if (desktopMetadata) existing.desktopMetadata = desktopMetadata;
    if (mobileMetadata) existing.mobileMetadata = mobileMetadata;

    existing.title = (title || "").trim();
    existing.subtitle = (subtitle || "").trim();
    existing.ctaText = (ctaText || "").trim();
    existing.ctaUrl = (ctaUrl || "").trim();

    if (typeof order === "number") existing.order = order;
    if (status) existing.status = status === "Inactive" ? "Inactive" : "Active";
    existing.startDate = startDate ? new Date(startDate) : null;
    existing.endDate = endDate ? new Date(endDate) : null;

    await existing.save();
    res.json(existing);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/hero-banners/reorder (Admin only) ─────────────────────────────
router.patch("/reorder", protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body as { items: Array<{ id: string; order: number }> };
    if (!Array.isArray(items)) {
      res.status(400).json({ message: "items must be an array of { id, order }." });
      return;
    }

    const bulkOps = items.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { order: item.order } },
      },
    }));

    if (bulkOps.length > 0) {
      await HeroBanner.bulkWrite(bulkOps);
    }

    const updatedBanners = await HeroBanner.find().sort({ order: 1, createdAt: -1 });
    res.json(updatedBanners);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/hero-banners/:id/status (Admin only) ──────────────────────────
router.patch("/:id/status", protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: "Active" | "Inactive" };
    if (!status || !["Active", "Inactive"].includes(status)) {
      res.status(400).json({ message: "Status must be either 'Active' or 'Inactive'." });
      return;
    }

    const banner = await HeroBanner.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );

    if (!banner) {
      res.status(404).json({ message: "Banner not found" });
      return;
    }

    res.json(banner);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/hero-banners/:id (Admin only) ────────────────────────────────
router.delete("/:id", protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banner = await HeroBanner.findById(req.params.id);
    if (!banner) {
      res.status(404).json({ message: "Banner not found" });
      return;
    }

    // Clean up images from R2 bucket
    await safelyDeleteR2Image(banner.desktopImageUrl, banner.desktopImageKey);
    await safelyDeleteR2Image(banner.mobileImageUrl, banner.mobileImageKey);

    await HeroBanner.findByIdAndDelete(req.params.id);
    res.json({ message: "Banner and associated images deleted successfully." });
  } catch (err) {
    next(err);
  }
});

export default router;
