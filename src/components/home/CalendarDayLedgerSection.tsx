'use client';

import { Wallet } from 'lucide-react';
import type { LedgerEntry } from '@/features/ledger/ledgerTypes';
import { formatLedgerCategory } from '@/features/ledger/ledgerCategoryLabels';
import { formatLedgerPaymentMethod } from '@/features/ledger/ledgerPaymentMethod';

type Theme = {
  text: string;
  textSecondary: string;
  border: string;
  radiusLg: number;
  card: string;
};

type CalendarDayLedgerSectionProps = {
  entries: LedgerEntry[];
  getMemberName: (userId: string) => string;
  t: (key: string) => string;
  theme: Theme;
  highContrast: boolean;
  onOpenLedgerTab: () => void;
};

export function CalendarDayLedgerSection({
  entries,
  getMemberName,
  t,
  theme,
  highContrast,
  onOpenLedgerTab,
}: CalendarDayLedgerSectionProps) {
  const fmtKrw = (n: number) => `${n.toLocaleString('ko-KR')}${t('ledgerWonSuffix')}`;

  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.direction === 'income') income += e.amount_krw;
    else expense += e.amount_krw;
  }

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 12,
        borderRadius: theme.radiusLg,
        border: theme.border,
        background: highContrast ? '#252525' : theme.card,
        boxShadow: highContrast ? 'none' : 'var(--shadow-card, none)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: entries.length > 0 ? 10 : 6,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: theme.text }}>
          <Wallet size={18} strokeWidth={1.5} aria-hidden />
          {t('ledgerCalendarDayTitle')}
        </span>
        <button
          type="button"
          onClick={onOpenLedgerTab}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: highContrast ? '1px solid #86efac' : '1px solid var(--accent)',
            background: highContrast ? '#14532d' : 'var(--accent-light)',
            color: highContrast ? '#86efac' : 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('ledgerCalendarPrefill')}
        </button>
      </div>

      {entries.length === 0 ? (
        <p style={{ fontSize: 12, color: theme.textSecondary, margin: 0, lineHeight: 1.5 }}>{t('ledgerCalendarEmptyDay')}</p>
      ) : (
        <>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 8, lineHeight: 1.45 }}>
            {t('ledgerCalendarDayIncome')}:{' '}
            <span style={{ color: highContrast ? '#86efac' : 'var(--accent)', fontWeight: 600 }}>{fmtKrw(income)}</span>
            {' · '}
            {t('ledgerCalendarDayExpense')}:{' '}
            <span style={{ color: highContrast ? '#fca5a5' : '#b91c1c', fontWeight: 600 }}>{fmtKrw(expense)}</span>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  fontSize: 12,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: highContrast ? '1px solid #444' : '1px solid var(--divider)',
                  background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
                }}
              >
                <div style={{ color: theme.textSecondary, marginBottom: 4 }}>
                  {formatLedgerCategory(e.category, t)} · {formatLedgerPaymentMethod(e.payment_method, t)} · {getMemberName(e.user_id)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: e.direction === 'income' ? 'var(--accent)' : '#b91c1c' }}>
                  {e.direction === 'income' ? '+' : '-'}
                  {fmtKrw(e.amount_krw)}
                </div>
                {e.memo ? (
                  <div style={{ marginTop: 4, color: theme.text, wordBreak: 'break-word' }}>{e.memo}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
