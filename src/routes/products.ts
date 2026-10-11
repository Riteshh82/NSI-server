import { Router, Request, Response } from "express";
import { Product } from "../models/Product";
import { protect } from "../middleware/auth";
import { deleteImagesByUrls } from "../services/r2";

const router = Router();

// GET /api/products — public, supports ?category=&status=&featured=&q=&productCode=
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, status, featured, isNewlyAdded, q, productCode, page = "1", limit = "20" } =
      req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (featured === "true") filter.featured = true;
    if (isNewlyAdded === "true") filter.isNewlyAdded = true;

    // Full-text + productCode combined search via $or
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { shortDescription: { $regex: q, $options: "i" } },
        { productCode: { $regex: q, $options: "i" } },
      ];
    } else if (productCode) {
      filter.productCode = { $regex: productCode, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .lean(),
      Product.countDocuments(filter),
    ]);

    // Send HTTP cache headers for public queries
    if (status === "Published" || !status) {
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    }

    res.json({ products, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/products/:slug — public
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    // Atomically increment views and return the product in one query
    const product = await Product.findOneAndUpdate(
      { slug: req.params.slug },
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/products/:id/click — public
router.patch("/:id/click", async (req: Request, res: Response) => {
  try {
    const { marketplace } = req.body;
    if (!["amazon", "flipkart", "myntra", "whatsapp"].includes(marketplace)) {
      res.status(400).json({ message: "Invalid marketplace" });
      return;
    }
    
    const updateField = `${marketplace}Clicks`;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { [updateField]: 1 } },
      { new: true }
    );
    
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json({ message: "Click recorded", clicks: product.get(updateField) });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── Helpers ──
function validatePricing(body: any) {
  if (body.mrp !== undefined || body.sellingPrice !== undefined || body.price !== undefined) {
    const mrp = Number(body.mrp ?? 0);
    const sellingPrice = Number(body.sellingPrice ?? body.price ?? 0);
    
    if (isNaN(mrp) || isNaN(sellingPrice)) throw new Error("Invalid numeric price values");
    if (mrp < 0) throw new Error("MRP cannot be negative");
    if (sellingPrice < 0) throw new Error("Selling Price cannot be negative");
    if (sellingPrice > mrp && mrp !== 0) throw new Error("Selling Price cannot be greater than MRP");

    body.mrp = mrp;
    body.sellingPrice = sellingPrice;
    body.price = sellingPrice; // Maintain backward compatibility
  }
}

// POST /api/products — admin only
router.post("/", protect, async (req: Request, res: Response) => {
  try {
    validatePricing(req.body);
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/products/:id — admin only
// Handles image replacement: deletes old R2 images that are no longer referenced.
router.put("/:id", protect, async (req: Request, res: Response) => {
  try {
    validatePricing(req.body);

    // Capture old images before update so we can clean up orphans
    const old = await Product.findById(req.params.id).select("images").lean();
    const oldImages: string[] = old?.images ?? [];

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    // Delete R2 objects that are no longer referenced by this product
    const newImages = new Set<string>(product.images);
    const removed = oldImages.filter((u) => !newImages.has(u));
    if (removed.length > 0) {
      // Fire-and-forget; don't block the response
      deleteImagesByUrls(removed).catch((err) =>
        console.error("[R2] cleanup after product update failed:", err)
      );
    }

    res.json(product);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/products/:id — admin only
// Also deletes associated R2 images after the DB record is removed.
router.delete("/:id", protect, async (req: Request, res: Response) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (product && product.images.length > 0) {
      // Fire-and-forget cleanup; product is already removed from DB
      deleteImagesByUrls(product.images).catch((err) =>
        console.error("[R2] cleanup after product delete failed:", err)
      );
    }
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
