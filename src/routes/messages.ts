import { Router, Request, Response } from "express";
import { ContactMessage, type MessageStatus } from "../models/ContactMessage";
import { protect } from "../middleware/auth";

const router = Router();

// POST /api/messages — public (contact form)
router.post("/", async (req: Request, res: Response) => {
  try {
    const message = await ContactMessage.create(req.body);
    res.status(201).json({
      message: "Message received. We'll get back to you within one business day.",
      id: message._id,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

// GET /api/messages — admin only
router.get("/", protect, async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status && status !== "all") filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [messages, total] = await Promise.all([
      ContactMessage.find(filter).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      ContactMessage.countDocuments(filter),
    ]);
    res.json({ messages, total });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/messages/:id — admin only (update status)
router.put("/:id", protect, async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status: MessageStatus };
    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    res.json(message);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

export default router;
