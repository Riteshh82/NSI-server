import { Router, Request, Response } from "express";
import { BulkOrder, type InquiryStatus } from "../models/BulkOrder";
import { protect } from "../middleware/auth";

const router = Router();

// POST /api/bulk-orders — public (form submission)
router.post("/", async (req: Request, res: Response) => {
  try {
    const order = await BulkOrder.create(req.body);
    res.status(201).json({
      message: "Inquiry received. Our team will contact you within one business day.",
      id: order._id,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

// GET /api/bulk-orders — admin only
router.get("/", protect, async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status && status !== "all") filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      BulkOrder.find(filter).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      BulkOrder.countDocuments(filter),
    ]);
    res.json({ orders, total });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/bulk-orders/:id — admin only
router.get("/:id", protect, async (req: Request, res: Response) => {
  try {
    const order = await BulkOrder.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    res.json(order);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/bulk-orders/:id — admin only (update status / add note)
router.put("/:id", protect, async (req: Request, res: Response) => {
  try {
    const { status, note } = req.body as { status?: InquiryStatus; note?: string };
    const order = await BulkOrder.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    if (status) order.status = status;
    if (note?.trim()) order.notes.push(note.trim());
    await order.save();
    res.json(order);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

export default router;
