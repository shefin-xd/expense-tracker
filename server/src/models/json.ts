import type { SchemaOptions } from 'mongoose';

/** Public JSON shape: `id` instead of `_id`, no `__v`. */
export const jsonOpts: NonNullable<SchemaOptions['toJSON']> = {
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
};
