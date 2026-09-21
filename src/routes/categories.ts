import { Router, Request, Response } from "express";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { protect } from "../middleware/auth";

const router = Router();

// GET /api/categories — public
// Returns categories with live productCount computed from the Product collection.
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [categories, countAgg] = await Promise.all([
      Category.find().sort({ name: 1 }),
      // Aggregate live product counts grouped by category name
      Product.aggregate<{ _id: string; count: number }>([
        { $match: { status: "Published" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    ]);

    // Build a lookup map: categoryName → count
    const countMap = new Map<string, number>(
      countAgg.map((item) => [item._id, item.count])
    );

    // Merge live counts into category documents
    const result = categories.map((cat) => ({
      ...cat.toObject(),
      productCount: countMap.get(cat.name) ?? 0,
    }));

    res.json(result);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/categories — admin only
router.post("/", protect, async (req: Request, res: Response) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json(category);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/categories/:id — admin only
router.put("/:id", protect, async (req: Request, res: Response) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }
    res.json(category);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/categories/:id — admin only
router.delete("/:id", protect, async (req: Request, res: Response) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: "Category deleted" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
