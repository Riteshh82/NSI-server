import { Schema, model, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IAdmin extends Document {
  email: string;
  passwordHash: string;
  role: "admin" | "superadmin";
  isActive: boolean;
  failedLoginAttempts: number;
  lockUntil?: Date | null;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  comparePassword(candidate: string): Promise<boolean>;
  isLocked(): boolean;
  incrementFailedLogins(): Promise<void>;
  resetFailedLogins(ip?: string): Promise<void>;
}

const adminSchema = new Schema<IAdmin>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "superadmin"], default: "admin" },
    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
  },
  { timestamps: true }
);

adminSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

adminSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

adminSchema.methods.incrementFailedLogins = async function (): Promise<void> {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME_MS = 15 * 60 * 1000; // 15-minute temporary lockout

  const updates: any = { $inc: { failedLoginAttempts: 1 } };
  if (this.failedLoginAttempts + 1 >= MAX_ATTEMPTS && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_TIME_MS) };
  }
  await this.updateOne(updates);
};

adminSchema.methods.resetFailedLogins = async function (ip?: string): Promise<void> {
  const updates: any = {
    $set: {
      failedLoginAttempts: 0,
      lastLoginAt: new Date(),
      ...(ip ? { lastLoginIp: ip } : {}),
    },
    $unset: { lockUntil: 1 },
  };
  await this.updateOne(updates);
};

export const Admin = model<IAdmin>("Admin", adminSchema);
