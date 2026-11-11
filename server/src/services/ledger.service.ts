import { Types, type ClientSession } from 'mongoose';
import { LedgerEntry } from '../models/LedgerEntry';
import { assertPaise } from '../utils/money';
import { LEDGER_KINDS, summarizeTotals, type KindTotals, type LedgerKind, type LedgerSummary } from './ledger.rules';

export interface RecordEntryInput {
  userId: string;
  kind: LedgerKind;
  amountPaise: number;
  date: Date;
  title: string;
  category?: string;
  sourceType: string;
  sourceId: string;
}

/** Post one entry. Pass a session to make it atomic with the domain record write. */
export async function recordEntry(input: RecordEntryInput, session?: ClientSession) {
  assertPaise(input.amountPaise);
  const [doc] = await LedgerEntry.create(
    [
      {
        ...input,
        userId: new Types.ObjectId(input.userId),
        sourceId: new Types.ObjectId(input.sourceId),
      },
    ],
    { session },
  );
  return doc;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

export async function getKindTotals(userId: string, range: DateRange = {}): Promise<KindTotals> {
  const match: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (range.from || range.to) {
    match.date = { ...(range.from && { $gte: range.from }), ...(range.to && { $lte: range.to }) };
  }
  const rows = await LedgerEntry.aggregate<{ _id: LedgerKind; total: number }>([
    { $match: match },
    { $group: { _id: '$kind', total: { $sum: '$amountPaise' } } },
  ]);
  const totals: KindTotals = {};
  for (const r of rows) if ((LEDGER_KINDS as readonly string[]).includes(r._id)) totals[r._id] = r.total;
  return totals;
}

export async function getSummary(userId: string, range: DateRange = {}): Promise<LedgerSummary> {
  return summarizeTotals(await getKindTotals(userId, range));
}

export async function syncEntry(
  userId: string,
  sourceType: string,
  sourceId: string,
  patch: { amountPaise?: number; date?: Date; title?: string; category?: string },
  session?: ClientSession,
) {
  if (patch.amountPaise !== undefined) assertPaise(patch.amountPaise);
  await LedgerEntry.updateOne(
    { userId: new Types.ObjectId(userId), sourceType, sourceId: new Types.ObjectId(sourceId) },
    { $set: patch },
    { session },
  );
}

export async function removeEntries(
  userId: string,
  sourceType: string,
  sourceIds: string[],
  session?: ClientSession,
) {
  if (!sourceIds.length) return;
  await LedgerEntry.deleteMany(
    { userId: new Types.ObjectId(userId), sourceType, sourceId: { $in: sourceIds.map((i) => new Types.ObjectId(i)) } },
    { session },
  );
}
