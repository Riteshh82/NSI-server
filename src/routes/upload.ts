import { Router } from "express";
import multer from "multer";
import { GridFsStorage } from "multer-gridfs-storage";
import mongoose from "mongoose";
import { protect } from "../middleware/auth";
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// Ensure MongoDB URI is available
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
  throw new Error("MONGODB_URI is required for GridFS storage");
}

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads" // Collection name in MongoDB (uploads.files, uploads.chunks)
        };
        resolve(fileInfo);
      });
    });
  }
});

// Configure multer
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."));
    }
  }
});

// @route   POST /api/upload
// @desc    Upload an image
// @access  Private (Admin only)
router.post("/", protect, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded or invalid file type" });
  }
  
  // Return the URL to access the image
  const imageUrl = `/api/upload/${req.file.filename}`;
  res.status(201).json({ url: imageUrl });
});

// @route   GET /api/upload/:filename
// @desc    Get image by filename
// @access  Public
router.get("/:filename", async (req, res) => {
  try {
    if (!mongoose.connection.db) {
      return res.status(500).json({ message: "Database not connected" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads"
    });

    const files = await bucket.find({ filename: req.params.filename }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "Image not found" });
    }

    const file = files[0];
    
    // Set proper content type
    res.set("Content-Type", file.contentType || "image/jpeg");
    
    // Stream the file directly to response
    const readStream = bucket.openDownloadStreamByName(req.params.filename);
    readStream.pipe(res);
  } catch (err) {
    console.error("Error retrieving image:", err);
    res.status(500).json({ message: "Error retrieving image" });
  }
});

export default router;
