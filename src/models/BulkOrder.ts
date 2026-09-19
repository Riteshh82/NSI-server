import { Schema, model, Document } from "mongoose";

export type InquiryStatus =
  | "New"
  | "Contacted"
  | "In Progress"
  | "Quoted"
  | "Completed"
  | "Cancelled";

export interface IBulkOrder extends Document {
  customerName: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  product: string;
  quantity: string;
  projectType: string;
  message: string;
  attachmentUrl?: string;
  status: InquiryStatus;
  notes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const bulkOrderSchema = new Schema<IBulkOrder>(
  {
    customerName: { type: String, required: true, trim: true },
    company: { type: String, default: "" },
    phone: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    city: { type: String, default: "" },
    product: { type: String, required: true },
    quantity: { type: String, required: true },
    projectType: { type: String, default: "" },
    message: { type: String, default: "" },
    attachmentUrl: { type: String },
    status: {
      type: String,
      enum: ["New", "Contacted", "In Progress", "Quoted", "Completed", "Cancelled"],
      default: "New",
    },
    notes: [{ type: String }],
  },
  { timestamps: true }
);

bulkOrderSchema.index({ status: 1 });
bulkOrderSchema.index({ createdAt: -1 });

export const BulkOrder = model<IBulkOrder>("BulkOrder", bulkOrderSchema);
