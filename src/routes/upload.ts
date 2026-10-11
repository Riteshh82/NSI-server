import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import sharp from "sharp";
import { protect } from "../middleware/auth";
import {
  generateObjectKey,
  uploadToR2,
  deleteFromR2,
  keyFromUrl,
  isR2Configured,
} from "../services/r2";

const router = Router();

const MAX_MB = parseInt(process.env.UPLOAD_MAX_MB ?? "10", 10);
const MAX_FILE_SIZE_BYTES = MAX_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

function detectMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 4) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // GIF: GIF87a or GIF89a
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return "image/gif";
  }

  // WebP: RIFF ... WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }

  // AVIF: ISO Base Media box with 'ftyp' and brand 'avif' or 'avis'
  if (buf.length >= 12) {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis" || brand === "ftyp") return "image/avif";
  }

  // SVG: Inspect text content
  const textSample = buf.subarray(0, 1024).toString("utf8").trim().toLowerCase();
  if (
    (textSample.startsWith("<?xml") || textSample.startsWith("<svg") || textSample.includes("<svg")) &&
    buf.toString("utf8").toLowerCase().includes("</svg>")
  ) {
    return "image/svg+xml";
  }

  return null;
}

/** Sanitize SVG buffer to protect against XSS/script injection */
function sanitizeSvg(buf: Buffer): { safe: boolean; error?: string } {
  const content = buf.toString("utf8");
  const lower = content.toLowerCase();

  // Block dangerous tags and scripts
  const dangerousPatterns = [
    /<script\b/i,
    /<\/script>/i,
    /<foreignobject\b/i,
    /\bon[a-z]+\s*=/i, // onload, onerror, onclick, etc.
    /javascript\s*:/i,
    /data:\s*text\/html/i,
    /xlink:href\s*=\s*['"]\s*javascript:/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /href\s*=\s*['"]\s*javascript:/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(lower)) {
      return { safe: false, error: "SVG contains prohibited scripts or active content." };
    }
  }

  return { safe: true };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    if (ALLOWED_MIME_TYPES.has(mime) || mime === "image/svg") {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed formats: JPEG, PNG, WebP, GIF, AVIF, SVG."));
    }
  },
});

// ── POST /api/upload — admin only ────────────────────────────────────────────

router.post(
  "/",
  protect,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("image")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({
            message: `File exceeds maximum upload size of ${MAX_MB}MB. Please choose a smaller file.`,
          });
          return;
        }
        res.status(400).json({ message: err.message ?? "Image upload failed." });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isR2Configured()) {
        res.status(503).json({
          message:
            "Cloudflare R2 storage is not properly configured. Check your R2 environment variables.",
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "No file uploaded or invalid file format." });
        return;
      }

      const buf = req.file.buffer;

      // Validate actual file content (magic bytes/structure)
      const detectedMime = detectMimeFromBuffer(buf);
      if (!detectedMime) {
        res.status(400).json({
          message:
            "File content does not match a supported image format (JPEG, PNG, WebP, GIF, AVIF, SVG).",
        });
        return;
      }

      let width = 0;
      let height = 0;
      let format = detectedMime.replace("image/", "").replace("+xml", "");

      if (detectedMime === "image/svg+xml") {
        const svgCheck = sanitizeSvg(buf);
        if (!svgCheck.safe) {
          res.status(400).json({
            message: svgCheck.error || "Untrusted or malicious SVG file rejected.",
          });
          return;
        }

        try {
          const meta = await sharp(buf).metadata();
          width = meta.width ?? 0;
          height = meta.height ?? 0;
          format = "svg";
        } catch {
          // If sharp cannot get dimensions from SVG, parse viewBox/width/height attributes
          const svgStr = buf.toString("utf8");
          const vb = svgStr.match(/viewBox\s*=\s*["']\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
          if (vb) {
            width = Math.round(parseFloat(vb[3]));
            height = Math.round(parseFloat(vb[4]));
          }
          format = "svg";
        }
      } else {
        // Raster image: validate with sharp to detect corruption & extract dimensions
        try {
          const imageInstance = sharp(buf, { animated: true });
          const meta = await imageInstance.metadata();

          if (!meta.width || !meta.height) {
            res.status(400).json({ message: "Corrupted image file: unable to read dimensions." });
            return;
          }

          width = meta.width;
          height = meta.height;
          format = meta.format ?? format;
        } catch (sharpErr: any) {
          res.status(400).json({
            message: `Corrupted or invalid image file (${sharpErr.message || "Failed to process"}).`,
          });
          return;
        }
      }

      // Check folder and identifier query params
      const folder = (req.query.folder as string | undefined) || "products";
      const identifier =
        (req.query.productId as string | undefined) ||
        (req.query.identifier as string | undefined) ||
        "item";

      const key = generateObjectKey(identifier, req.file.originalname, folder);
      const result = await uploadToR2(key, buf, detectedMime);

      const metadata = {
        filename: req.file.originalname,
        size: req.file.size,
        width,
        height,
        format,
        mimeType: detectedMime,
      };

      res.status(201).json({
        url: result.url,
        key: result.key,
        metadata,
      });
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
      const { url, key: bodyKey } = req.body as { url?: string; key?: string };
      const key = bodyKey || (url ? keyFromUrl(url) : undefined);

      if (!key) {
        res.status(400).json({ message: "Valid URL or object key is required." });
        return;
      }

      await deleteFromR2(key);
      res.json({ message: "Image deleted successfully." });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    storage: "cloudflare-r2",
    configured: isR2Configured(),
    maxUploadMb: MAX_MB,
  });
});

export default router;
