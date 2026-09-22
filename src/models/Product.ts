import { Schema, model, Document } from "mongoose";

export interface IProduct extends Document {
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  tags: string[];
  images: string[];
  specifications: {
    material: string;
    finish: string;
    dimensions: string;
    weight: string;
    color: string;
    applications: string[];
  };
  finishes: string[];
  price: number;
  productCode: string;
  amazonUrl: string;
  flipkartUrl: string;
  myntraUrl: string;
  whatsappOrder: boolean;
  featured: boolean;
  bulkAvailable: boolean;
  status: "Published" | "Draft";
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const specSchema = new Schema(
  {
    material: { type: String, default: "" },
    finish: { type: String, default: "" },
    dimensions: { type: String, default: "" },
    weight: { type: String, default: "" },
    color: { type: String, default: "" },
    applications: [{ type: String }],
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    shortDescription: { type: String, default: "" },
    fullDescription: { type: String, default: "" },
    tags: [{ type: String }],
    images: [{ type: String }],
    specifications: { type: specSchema, default: () => ({}) },
    finishes: [{ type: String }],
    price: { type: Number, default: 0 },
    productCode: { type: String, default: "", trim: true },
    amazonUrl: { type: String, default: "" },
    flipkartUrl: { type: String, default: "" },
    myntraUrl: { type: String, default: "" },
    whatsappOrder: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    bulkAvailable: { type: Boolean, default: true },
    status: { type: String, enum: ["Published", "Draft"], default: "Draft" },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", shortDescription: "text" });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ featured: 1 });

productSchema.pre("validate", function (next) {
  if (!this.slug) {
    const slugify = (text: string) =>
      text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");

    const base = slugify(this.name || "");
    const code = this.productCode ? slugify(this.productCode) : "";
    const hash = Math.random().toString(36).slice(2, 7);

    if (code) {
      this.slug = `${code}-${hash}`;
    } else {
      this.slug = `${base}-${hash}`;
    }
    this.slug = this.slug.slice(0, 80);
  }
  next();
});

export const Product = model<IProduct>("Product", productSchema);
