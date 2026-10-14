import { Schema, model, Document } from "mongoose";

export interface IAuditLog extends Document {
  action: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "ACCOUNT_LOCKED" | "LOGOUT" | "SUSPICIOUS_ACCESS" | "PASSWORD_CHANGE";
  email?: string;
  ipAddress: string;
  userAgent?: string;
  status: "SUCCESS" | "FAILURE" | "BLOCKED";
  details?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: ["LOGIN_SUCCESS", "LOGIN_FAILED", "ACCOUNT_LOCKED", "LOGOUT", "SUSPICIOUS_ACCESS", "PASSWORD_CHANGE"],
      index: true,
    },
    email: { type: String, lowercase: true, trim: true, index: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String },
    status: { type: String, enum: ["SUCCESS", "FAILURE", "BLOCKED"], required: true },
    details: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Auto-expire logs after 90 days to prevent unbounded DB growth
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
