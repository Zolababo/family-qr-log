export type LedgerPaymentMethod = 'card' | 'cash' | 'gift' | 'gglocal' | 'other';

export const LEDGER_PAYMENT_METHODS: LedgerPaymentMethod[] = [
  'card',
  'cash',
  'gift',
  'gglocal',
  'other',
];

export const LEDGER_PAYMENT_METHOD_TKEY: Record<LedgerPaymentMethod, string> = {
  card: 'ledgerPaymentCard',
  cash: 'ledgerPaymentCash',
  gift: 'ledgerPaymentGift',
  gglocal: 'ledgerPaymentGgLocal',
  other: 'ledgerPaymentOther',
};

export function normalizeLedgerPaymentMethod(raw: string | null | undefined): LedgerPaymentMethod {
  const v = String(raw ?? '').trim().toLowerCase();
  switch (v) {
    case 'card':
      return 'card';
    case 'cash':
      return 'cash';
    case 'gift':
      return 'gift';
    case 'gglocal':
      return 'gglocal';
    case 'other':
      return 'other';
    default:
      return 'other';
  }
}

export function formatLedgerPaymentMethod(
  value: string | null | undefined,
  t: (key: string) => string
): string {
  const normalized = normalizeLedgerPaymentMethod(value);
  return t(LEDGER_PAYMENT_METHOD_TKEY[normalized]);
}
