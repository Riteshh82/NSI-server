import { Router, Request, Response } from "express";
import { NewlyAdded } from "../models/NewlyAdded";
import { protect } from "../middleware/auth";

const router = Router();

// GET /api/newlyadded (Public)
router.get("/", async (req: Request, res: Response) => {
  try {
    const newlyAdded = await NewlyAdded.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json(newlyAdded);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/newlyadded/all (Admin)
router.get("/all", protect, async (req: Request, res: Response) => {
  try {
    const newlyAdded = await NewlyAdded.find().sort({ order: 1, createdAt: -1 });
    res.json(newlyAdded);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/newlyadded (Admin)
router.post("/", protect, async (req: Request, res: Response) => {
  try {
    const newlyAdded = new NewlyAdded(req.body);
    await newlyAdded.save();
    res.status(201).json(newlyAdded);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/newlyadded/:id (Admin)
router.patch("/:id", protect, async (req: Request, res: Response) => {
  try {
    const newlyAdded = await NewlyAdded.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!newlyAdded) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    res.json(newlyAdded);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/newlyadded/:id (Admin)
router.delete("/:id", protect, async (req: Request, res: Response) => {
  try {
    const newlyAdded = await NewlyAdded.findByIdAndDelete(req.params.id);
    if (!newlyAdded) {
      res.status(404).json({ message: "Item not found" });
      return;
    }
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
