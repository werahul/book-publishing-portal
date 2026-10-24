import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { ROLES } from '@bookleaf/shared';

/** The public, author-visible conversation on a ticket. Internal notes live in their own collection. */
const messageSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ROLES, required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 10000 },
    /** True when an admin started from the AI draft (tracks AI adoption). */
    aiAssisted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

messageSchema.index({ ticket: 1, createdAt: 1 });

export type MessageRecord = InferSchemaType<typeof messageSchema> & { _id: Types.ObjectId };
export const Message = model('Message', messageSchema);
