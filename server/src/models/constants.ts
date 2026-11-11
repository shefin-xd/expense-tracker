export const DEFAULT_EXPENSE_CATEGORIES = [
  'Food', 'Snacks', 'Mess', 'Hostel', 'Transportation', 'Shopping', 'Education',
  'Stationery', 'Mobile Recharge', 'Internet', 'Entertainment', 'Personal Care', 'Medical', 'Other',
] as const;

export const PAYMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'debit_card', 'credit_card', 'other'] as const;

export const INCOME_SOURCES = [
  'parents', 'pocket_money', 'relatives', 'scholarship', 'part_time', 'freelancing', 'internship', 'refund', 'other',
] as const;

export const INCOME_SOURCE_LABELS: Record<(typeof INCOME_SOURCES)[number], string> = {
  parents: 'Money from parents',
  pocket_money: 'Monthly pocket money',
  relatives: 'Money from relatives',
  scholarship: 'Scholarship',
  part_time: 'Part-time work',
  freelancing: 'Freelancing',
  internship: 'Internship',
  refund: 'Refund',
  other: 'Other income',
};

/** Sources counted by the "money from parents" tracker. */
export const PARENT_SOURCES = ['parents', 'pocket_money'] as const;

export const FEE_CATEGORIES = [
  'tuition', 'university_exam', 'admission', 'hostel', 'mess', 'library', 'lab', 'transportation', 'other_academic',
] as const;
