import type { Response } from 'express';
import { notFound } from './errors';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const ok = (res: Response, data: unknown, status = 200, meta?: PageMeta) =>
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });

export const pageMeta = (page: number, limit: number, total: number): PageMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Ids from the URL must be well-formed ObjectIds; anything else is a plain 404. */
export function parseId(id: unknown): string {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw notFound();
  return id;
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
