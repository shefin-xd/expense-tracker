import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { IdempotencyKey } from '../models/IdempotencyKey';
import { AppError, badRequest } from '../utils/errors';

const KEY = /^[A-Za-z0-9_-]{8,100}$/;
const STALE_MS = 60_000; // a request that never answered is retryable after a minute

/**
 * Send `Idempotency-Key: <random id>` with a POST. If the same key arrives again (double tap, flaky network retry)
 * the first result is replayed instead of creating a second record. Must run after requireAuth.
 */
export const idempotent: RequestHandler = async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (req.method !== 'POST' || !key) return next();
  if (!KEY.test(key)) return next(badRequest('Idempotency-Key must be 8 to 100 letters, numbers, dashes or underscores'));

  const userId = new Types.ObjectId(req.userId!);
  const fingerprint = createHash('sha256').update(`${req.method} ${req.baseUrl}${req.path} ${JSON.stringify(req.body ?? {})}`).digest('hex');

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await IdempotencyKey.create({ userId, key, fingerprint, state: 'processing' });
        break; // we own this key
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
        const existing = await IdempotencyKey.findOne({ userId, key });
        if (!existing) continue; // deleted between the two calls: try to claim it again
        if (existing.fingerprint !== fingerprint) throw new AppError(422, 'This Idempotency-Key was already used for a different request', 'IDEMPOTENCY_MISMATCH');
        if (existing.state === 'done') {
          res.set('Idempotent-Replayed', 'true');
          return void res.status(existing.status ?? 200).json(existing.body);
        }
        if (Date.now() - existing.createdAt.getTime() > STALE_MS) { await IdempotencyKey.deleteOne({ userId, key, state: 'processing' }); continue; }
        throw new AppError(409, 'The same request is still being processed. Try again in a moment.', 'IN_PROGRESS');
      }
    }
  } catch (e) {
    return next(e);
  }

  // Record the outcome before answering. Successful results are replayed; failures free the key so the user can retry.
  const send = res.json.bind(res);
  res.json = ((body: unknown) => {
    // Store exactly the JSON the client receives (documents have toJSON rules such as id instead of _id).
    const finish = res.statusCode < 400
      ? IdempotencyKey.updateOne({ userId, key }, { $set: { state: 'done', status: res.statusCode, body: JSON.parse(JSON.stringify(body)) } })
      : IdempotencyKey.deleteOne({ userId, key });
    finish.catch(() => undefined).finally(() => send(body));
    return res;
  }) as typeof res.json;
  next();
};
