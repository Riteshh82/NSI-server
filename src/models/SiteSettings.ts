import { Schema, model, Document } from "mongoose";

export interface ISiteSettings extends Document {
  name: string;
  logoInitial: string;
  phone: string;
  email: string;
  address: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  whatsapp: string;
  amazonStoreUrl: string;
  flipkartStoreUrl: string;
  notifyBulkOrders: boolean;
  notifyMessages: boolean;
  notifyWeeklySummary: boolean;
}

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    name: { type: String, default: "NEXT STEEL INNOVATION" },
    logoInitial: { type: String, default: "N" },
    phone: { type: String, default: "+91 98765 43210" },
    email: { type: String, default: "hello@nextsteelinnovation.in" },
    address: { type: String, default: "Plot 14, Industrial Estate, Lower Parel, Mumbai, Maharashtra 400013" },
    instagram: { type: String, default: "https://instagram.com/nextsteelinnovation" },
    facebook: { type: String, default: "https://facebook.com/nextsteelinnovation" },
    linkedin: { type: String, default: "https://linkedin.com/company/nextsteelinnovation" },
    whatsapp: { type: String, default: "https://wa.me/919876543210" },
    amazonStoreUrl: { type: String, default: "https://www.amazon.in/s?k=nextsteelinnovation" },
    flipkartStoreUrl: { type: String, default: "https://www.flipkart.com/search?q=nextsteelinnovation" },
    notifyBulkOrders: { type: Boolean, default: true },
    notifyMessages: { type: Boolean, default: true },
    notifyWeeklySummary: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const SiteSettings = model<ISiteSettings>("SiteSettings", siteSettingsSchema);
