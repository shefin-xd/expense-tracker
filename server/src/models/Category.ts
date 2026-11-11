import { Schema, model } from 'mongoose';
import { jsonOpts } from './json';

const categorySchema = new Schema(
  { userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, name: { type: String, required: true, trim: true, maxlength: 40 } },
  { timestamps: true, toJSON: jsonOpts },
);
categorySchema.index({ userId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
export const Category = model('Category', categorySchema);
