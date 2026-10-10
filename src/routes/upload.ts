import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { protect } from "../middleware/auth";
import {
  generateObjectKey,
  uploadToR2,
  deleteFromR2,
  keyFromUrl,
} from "../services/r2";

const router = Router();



const MAX_FILE_SIZE_BYTES = parseInt(process.env.UPLOAD_MAX_MB ?? "10") * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);



const MAGIC: Array<{ bytes: number[]; mask?: number[]; mime: string }> = [
  { bytes: [0xff, 0xd8, 0xff],                           mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: "image/png" },
  { bytes: [0x52, 0x49, 0x46, 0x46],                     mime: "image/webp" }, 
  { bytes: [0x00, 0x00, 0x00],                            mime: "image/avif" },
];

function detectMimeFromBuffer(buf: Buffer): string | null {
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  // WebP: "RIFF" at 0, "WEBP" at 8
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  // AVIF: ISO Base Medi File Format box with 'avif' or 'avis' brand
  if (buf.length >= 12) {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis" || brand === "ftyp") return "image/avif";
  }
  return null;
}



const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: JPEG, PNG, WebP, AVIF."));
    }
  },
});

// ── POST /api/upload — admin only ────────────────────────────────────────────

router.post(
  "/",
  protect,
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ message: "No file uploaded or invalid file type." });
        return;
      }

      const buf = req.file.buffer;

      // Validate actual file content (magic bytes)
      const detectedMime = detectMimeFromBuffer(buf);
      if (!detectedMime) {
        res.status(400).json({
          message: "File content does not match a supported image format (JPEG, PNG, WebP, AVIF).",
        });
        return;
      }

      // Use productId from query if provided, otherwise use a placeholder
      const productId = (req.query.productId as string | undefined) ?? "tmp";

      const key = generateObjectKey(productId, req.file.originalname);
      const result = await uploadToR2(key, buf, detectedMime);

      res.status(201).json({ url: result.url, key: result.key });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/",
  protect,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url } = req.body as { url?: string };
      if (!url) {
        res.status(400).json({ message: "url is required in request body." });
        return;
      }

      const key = keyFromUrl(url);
      if (!key) {
        res.status(400).json({ message: "URL does not belong to this R2 bucket." });
        return;
      }

      await deleteFromR2(key);
      res.json({ message: "Image deleted." });
    } catch (err) {
      next(err);
    }
  }
);


router.get("/health", (_req, res) => {
  res.json({ status: "ok", storage: "cloudflare-r2" });
});

export default router;
