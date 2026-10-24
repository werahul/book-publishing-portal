import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/**
 * Admin-only notes. Deliberately a separate collection (not a `visibility` flag on
 * messages): author-facing code never queries this collection, so a forgotten
 * filter can't leak a note. See docs/03-data-model.md.
 */
const internalNoteSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
  },
  { timestamps: true },
);

internalNoteSchema.index({ ticket: 1, createdAt: 1 });

export type InternalNoteRecord = InferSchemaType<typeof internalNoteSchema> & { _id: Types.ObjectId };
export const InternalNote = model('InternalNote', internalNoteSchema);
