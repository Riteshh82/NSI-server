import { Router, Request, Response } from "express";
import { SiteSettings } from "../models/SiteSettings";
import { protect } from "../middleware/auth";

const router = Router();

/**
 * GET /api/settings — public (used by frontend site pages)
 * Returns the single settings document, creating it with defaults if it doesn't exist.
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = await SiteSettings.create({});
    }
    res.json(settings);
  } catch (err) {
    throw err;
  }
});

/**
 * PUT /api/settings — admin only
 * Full or partial update of site settings.
 */
router.put("/", protect, async (req: Request, res: Response) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = await SiteSettings.create(req.body);
    } else {
      Object.assign(settings, req.body);
      await settings.save();
    }
    res.json(settings);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ message: error.message });
  }
});

export default router;
