import { Schema, model, Document } from "mongoose";

export type MessageStatus = "Unread" | "Read" | "Replied";

export interface IContactMessage extends Document {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: MessageStatus;
  createdAt: Date;
  updatedAt: Date;
}

const contactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, default: "" },
    subject: { type: String, default: "General Enquiry" },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["Unread", "Read", "Replied"],
      default: "Unread",
    },
  },
  { timestamps: true }
);

contactMessageSchema.index({ status: 1 });
contactMessageSchema.index({ createdAt: -1 });

export const ContactMessage = model<IContactMessage>("ContactMessage", contactMessageSchema);
