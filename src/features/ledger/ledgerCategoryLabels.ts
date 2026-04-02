/** Stable DB values for `ledger_entries.category` (locale-independent). */
export const LEDGER_CATEGORY_SLUGS = [
  'food',
  'transport',
  'shopping',
  'medical',
  'education',
  'subscription',
  'salary',
  'other',
] as const;

export type LedgerCategorySlug = (typeof LEDGER_CATEGORY_SLUGS)[number];

/** Translation keys (see `translations.ts` ledgerCat*). */
export const LEDGER_CATEGORY_TKEY: Record<LedgerCategorySlug, string> = {
  food: 'ledgerCatFood',
  transport: 'ledgerCatTransport',
  shopping: 'ledgerCatShopping',
  medical: 'ledgerCatMedical',
  education: 'ledgerCatEducation',
  subscription: 'ledgerCatSubscription',
  salary: 'ledgerCatSalary',
  other: 'ledgerCatOther',
};

/** Legacy rows saved with Korean preset labels before slug storage. */
const LEGACY_KO_TO_SLUG: Record<string, LedgerCategorySlug> = {
  식비: 'food',
  교통: 'transport',
  쇼핑: 'shopping',
  의료: 'medical',
  교육: 'education',
  구독: 'subscription',
  급여: 'salary',
  기타: 'other',
};

export function normalizeLedgerCategory(raw: string): LedgerCategorySlug {
  const trimmed = raw.trim();
  if ((LEDGER_CATEGORY_SLUGS as readonly string[]).includes(trimmed)) {
    return trimmed as LedgerCategorySlug;
  }
  return LEGACY_KO_TO_SLUG[trimmed] ?? 'other';
}

export function formatLedgerCategory(stored: string, t: (key: string) => string): string {
  const trimmed = stored.trim();
  if ((LEDGER_CATEGORY_SLUGS as readonly string[]).includes(trimmed)) {
    return t(LEDGER_CATEGORY_TKEY[trimmed as LedgerCategorySlug]);
  }
  const fromKo = LEGACY_KO_TO_SLUG[trimmed];
  if (fromKo) return t(LEDGER_CATEGORY_TKEY[fromKo]);
  return stored;
}
