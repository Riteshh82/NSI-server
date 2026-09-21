import { Router, Request, Response } from "express";
import { Product } from "../models/Product";
import { protect } from "../middleware/auth";

const router = Router();

// GET /api/products — public, supports ?category=&status=&featured=&q=&productCode=
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, status, featured, q, productCode, page = "1", limit = "20" } =
      req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (featured === "true") filter.featured = true;

    // Full-text + productCode combined search via $or
    if (q) {
      filter.$or = [
        { $text: { $search: q } },
        { productCode: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ];
    } else if (productCode) {
      filter.productCode = { $regex: productCode, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/products/:slug — public
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    // Increment views
    product.views += 1;
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/products — admin only
router.post("/", protect, async (req: Request, res: Response) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/products/:id — admin only
router.put("/:id", protect, async (req: Request, res: Response) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.json(product);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/products/:id — admin only
router.delete("/:id", protect, async (req: Request, res: Response) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
