import mongoose, { Schema } from "mongoose";

const UsageSchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // user email OR device id
    freeUsed: { type: Number, required: true, default: 0 },
    paid: { type: Boolean, required: true, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const SessionSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true },
    role: { type: String, default: "user" },
    isActive: { type: Boolean, default: true },
    subscription: {
      plan: { type: String, enum: ["free", "pro", "enterprise"], default: "free" },
      status: { type: String, default: "active" },
      scans_limit: { type: Number, default: 3 },
      projects_limit: { type: Number, default: 1 },
      scans_used: { type: Number, default: 0 },
      features: {
        predictive_analytics: { type: Boolean, default: false },
        smart_alerts: { type: Boolean, default: false },
        portfolio_view: { type: Boolean, default: false },
        advanced_financials: { type: Boolean, default: false },
        quality_control: { type: Boolean, default: false },
        custom_reports: { type: Boolean, default: false }
      },
      endDate: { type: Date }
    }
  },
  { timestamps: true }
);

export const Usage = mongoose.models.Usage ?? mongoose.model("Usage", UsageSchema);
export const Session = mongoose.models.Session ?? mongoose.model("Session", SessionSchema);
export const User = mongoose.models.User ?? mongoose.model("User", UserSchema);
