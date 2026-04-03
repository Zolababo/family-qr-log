/** Stable DB values for `ledger_entries.category` (locale-independent). Order matches product UI. */
export const LEDGER_CATEGORY_SLUGS = [
  'food',
  'health_culture',
  'clothing_beauty',
  'events_membership',
  'household_goods',
  'tax_interest',
  'transport_vehicle',
  'education_childcare',
  'allowance_misc',
  'housing_communication',
  'savings_insurance',
  'uncategorized',
] as const;

export type LedgerCategorySlug = (typeof LEDGER_CATEGORY_SLUGS)[number];

/** Translation keys (see `translations.ts` ledgerCat*). */
export const LEDGER_CATEGORY_TKEY: Record<LedgerCategorySlug, string> = {
  food: 'ledgerCatFood',
  health_culture: 'ledgerCatHealthCulture',
  clothing_beauty: 'ledgerCatClothingBeauty',
  events_membership: 'ledgerCatEventsMembership',
  household_goods: 'ledgerCatHouseholdGoods',
  tax_interest: 'ledgerCatTaxInterest',
  transport_vehicle: 'ledgerCatTransportVehicle',
  education_childcare: 'ledgerCatEducationChildcare',
  allowance_misc: 'ledgerCatAllowanceMisc',
  housing_communication: 'ledgerCatHousingCommunication',
  savings_insurance: 'ledgerCatSavingsInsurance',
  uncategorized: 'ledgerCatUncategorized',
};

/** Previous English slugs → new slug (existing rows still group/display correctly). */
const OLD_ENGLISH_SLUG_MIGRATION: Record<string, LedgerCategorySlug> = {
  food: 'food',
  transport: 'transport_vehicle',
  shopping: 'household_goods',
  medical: 'health_culture',
  education: 'education_childcare',
  subscription: 'allowance_misc',
  salary: 'savings_insurance',
  other: 'uncategorized',
};

/** Legacy rows saved with Korean preset labels before slug storage. */
const LEGACY_KO_TO_SLUG: Record<string, LedgerCategorySlug> = {
  식비: 'food',
  교통: 'transport_vehicle',
  쇼핑: 'household_goods',
  의료: 'health_culture',
  교육: 'education_childcare',
  구독: 'allowance_misc',
  급여: 'savings_insurance',
  기타: 'uncategorized',
  '건강/문화': 'health_culture',
  '의복/미용': 'clothing_beauty',
  '경조사/회비': 'events_membership',
  생활용품: 'household_goods',
  '세금/이자': 'tax_interest',
  '교통/차량': 'transport_vehicle',
  '교육/육아': 'education_childcare',
  '용돈/기타': 'allowance_misc',
  '주거/통신': 'housing_communication',
  '저축/보험': 'savings_insurance',
  미분류: 'uncategorized',
};

export function normalizeLedgerCategory(raw: string): LedgerCategorySlug {
  const trimmed = raw.trim();
  if ((LEDGER_CATEGORY_SLUGS as readonly string[]).includes(trimmed)) {
    return trimmed as LedgerCategorySlug;
  }
  const fromOld = OLD_ENGLISH_SLUG_MIGRATION[trimmed];
  if (fromOld) return fromOld;
  return LEGACY_KO_TO_SLUG[trimmed] ?? 'uncategorized';
}

export function formatLedgerCategory(stored: string, t: (key: string) => string): string {
  const trimmed = stored.trim();
  if (!trimmed) return t(LEDGER_CATEGORY_TKEY.uncategorized);
  if ((LEDGER_CATEGORY_SLUGS as readonly string[]).includes(trimmed)) {
    return t(LEDGER_CATEGORY_TKEY[trimmed as LedgerCategorySlug]);
  }
  const fromKo = LEGACY_KO_TO_SLUG[trimmed];
  if (fromKo) return t(LEDGER_CATEGORY_TKEY[fromKo]);
  const fromOld = OLD_ENGLISH_SLUG_MIGRATION[trimmed];
  if (fromOld) return t(LEDGER_CATEGORY_TKEY[fromOld]);
  return trimmed;
}
