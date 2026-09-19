import mongoose from "mongoose";

/**
 * Cached connection promise so serverless functions reuse the same
 * connection across warm invocations instead of opening a new one
 * on every request.
 */
let cached: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  if (!cached) {
    cached = mongoose.connect(uri, {
      // Recommended settings for serverless environments
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
    });
  }

  await cached;
}
