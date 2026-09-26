import mongoose from "mongoose";

const newlyAddedSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true },
    categorySlug: { type: String, required: true }, // The category to redirect to
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const NewlyAdded = mongoose.model("NewlyAdded", newlyAddedSchema);
