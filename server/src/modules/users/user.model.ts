import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { ROLES } from '@bookleaf/shared';

const authorProfileSchema = new Schema(
  {
    /** Dataset id, e.g. "AUTH001". */
    externalId: { type: String, required: true, trim: true },
    phone: { type: String, default: null },
    city: { type: String, default: null },
    joinedDate: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never returned unless explicitly requested with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    /** Present only for role = author. */
    authorProfile: { type: authorProfileSchema, default: undefined },
  },
  { timestamps: true },
);

userSchema.index({ 'authorProfile.externalId': 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });

export type UserRecord = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model('User', userSchema);
