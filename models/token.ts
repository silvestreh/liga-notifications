import mongoose, { Document, Schema } from "mongoose";

export interface IToken extends Document {
  token: string;
  platform: string;
  tags: string[];
  locale: string;
  lastActive: Date;
}

const tokenSchema = new Schema<IToken>({
  token: { type: String, required: true, unique: true },
  platform: { type: String, default: "ios" },
  tags: [String],
  locale: { type: String, default: "en" },
  lastActive: { type: Date, default: Date.now },
});

tokenSchema.index({ tags: 1 });
tokenSchema.index({ locale: 1 });

export default mongoose.model<IToken>("Token", tokenSchema);
