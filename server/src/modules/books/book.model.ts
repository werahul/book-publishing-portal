import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { PRINT_PARTNERS, PRODUCTION_STAGES } from '@bookleaf/shared';

const money = { type: Number, required: true, min: 0, default: 0 };

const bookSchema = new Schema(
  {
    /** Dataset id, e.g. "BK001". */
    externalId: { type: String, required: true, unique: true, trim: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    // Stored verbatim: the sample ISBNs are placeholders and fail checksum validation.
    isbn: { type: String, required: true, unique: true, trim: true },
    genre: { type: String, required: true, trim: true },
    publicationDate: { type: Date, default: null },
    stage: { type: String, enum: PRODUCTION_STAGES, required: true },
    // null while the book is in production.
    mrp: { type: Number, min: 0, default: null },
    royaltyPerCopy: { type: Number, min: 0, default: null },
    copiesSold: { type: Number, required: true, min: 0, default: 0 },
    royalty: {
      earned: money,
      paid: money,
      pending: money,
    },
    lastRoyaltyPayoutDate: { type: Date, default: null },
    printPartner: { type: String, enum: [...PRINT_PARTNERS, null], default: null },
    availableOn: { type: [String], default: [] },
  },
  { timestamps: true },
);

bookSchema.index({ author: 1, publicationDate: -1 });

export type BookRecord = InferSchemaType<typeof bookSchema> & { _id: Types.ObjectId };
export const Book = model('Book', bookSchema);
