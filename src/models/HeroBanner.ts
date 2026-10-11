import mongoose, { Document, Schema } from "mongoose";

export interface IImageMetadata {
  filename?: string;
  size?: number;
  width?: number;
  height?: number;
  format?: string;
}

export interface IHeroBanner extends Document {
  name: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  desktopImageKey?: string;
  mobileImageKey?: string;
  desktopMetadata?: IImageMetadata;
  mobileMetadata?: IImageMetadata;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaUrl?: string;
  order: number;
  status: "Active" | "Inactive";
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ImageMetadataSchema = new Schema<IImageMetadata>(
  {
    filename: { type: String, default: "" },
    size: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    format: { type: String, default: "" },
  },
  { _id: false }
);

const heroBannerSchema = new Schema<IHeroBanner>(
  {
    name: {
      type: String,
      required: [true, "Banner name is required"],
      trim: true,
      maxlength: [120, "Banner name cannot exceed 120 characters"],
    },
    desktopImageUrl: {
      type: String,
      required: [true, "Desktop banner image is required"],
      trim: true,
    },
    mobileImageUrl: {
      type: String,
      required: [true, "Mobile banner image is required"],
      trim: true,
    },
    desktopImageKey: {
      type: String,
      default: "",
    },
    mobileImageKey: {
      type: String,
      default: "",
    },
    desktopMetadata: {
      type: ImageMetadataSchema,
      default: () => ({}),
    },
    mobileMetadata: {
      type: ImageMetadataSchema,
      default: () => ({}),
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    subtitle: {
      type: String,
      trim: true,
      default: "",
    },
    ctaText: {
      type: String,
      trim: true,
      default: "",
    },
    ctaUrl: {
      type: String,
      trim: true,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast ordering & active filtering
heroBannerSchema.index({ status: 1, order: 1, createdAt: -1 });

export const HeroBanner = mongoose.model<IHeroBanner>("HeroBanner", heroBannerSchema);
