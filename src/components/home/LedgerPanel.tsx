'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, ChevronLeft, ChevronRight, CreditCard, Download, Ellipsis, Gift, Pencil, Ticket, Trash2 } from 'lucide-react';
import {
  LEDGER_CATEGORY_SLUGS,
  useHouseholdLedger,
} from '@/features/ledger/useHouseholdLedger';
import {
  LEDGER_CATEGORY_TKEY,
  formatLedgerCategory,
  normalizeLedgerCategory,
} from '@/features/ledger/ledgerCategoryLabels';
import {
  LEDGER_PAYMENT_METHODS,
  LEDGER_PAYMENT_METHOD_TKEY,
  formatLedgerPaymentMethod,
  normalizeLedgerPaymentMethod,
  type LedgerPaymentMethod,
} from '@/features/ledger/ledgerPaymentMethod';
import type { LedgerCategorySlug } from '@/features/ledger/ledgerCategoryLabels';
import type { LedgerDirection } from '@/features/ledger/ledgerTypes';

type Theme = {
  radiusLg: number;
  border: string;
  card: string;
  cardShadow: string;
  textSecondary: string;
  text: string;
};

export type LedgerPanelLedger = ReturnType<typeof useHouseholdLedger>;

type LedgerPanelProps = {
  ledger: LedgerPanelLedger;
  getMemberName: (userId: string) => string;
  onError: (message: string) => void;
  t: (key: string) => string;
  theme: Theme;
  highContrast: boolean;
  /** 캘린더 등에서 넘긴 날짜(YYYY-MM-DD) — 한 번 적용 후 소비 */
  occurredOnPrefill?: string | null;
  onOccurredOnPrefillConsumed?: () => void;
};

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 보고 있는 달에 맞춘 기본 거래일: 이번 달이면 오늘, 아니면 그 달 1일 */
function defaultDateForView(viewYear: number, viewMonth: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (viewYear === y && viewMonth === m) {
    return `${y}-${String(m).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`;
}

function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function LedgerPanel({
  ledger,
  getMemberName,
  onError,
  t,
  theme,
  highContrast,
  occurredOnPrefill,
  onOccurredOnPrefillConsumed,
}: LedgerPanelProps) {
  const { entries, loading, ledgerReady, loadEntries, loadMonthEntries, addEntry, updateEntry, deleteEntry } = ledger;

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);

  useEffect(() => {
    if (!ledgerReady) return;
    void loadMonthEntries(viewYear, viewMonth);
  }, [ledgerReady, viewYear, viewMonth, loadMonthEntries]);

  const shiftViewMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  };

  const monthSummary = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;
    let income = 0;
    let expense = 0;
    for (const e of entries) {
      if (!e.occurred_on.startsWith(prefix)) continue;
      if (e.direction === 'income') income += e.amount_krw;
      else expense += e.amount_krw;
    }
    return { income, expense, balance: income - expense, year: viewYear, month: viewMonth };
  }, [entries, viewYear, viewMonth]);

  const listEntries = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;
    return entries.filter((e) => e.occurred_on.startsWith(prefix));
  }, [entries, viewYear, viewMonth]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of listEntries) {
      if (e.direction !== 'expense') continue;
      const c = normalizeLedgerCategory(e.category);
      map.set(c, (map.get(c) ?? 0) + e.amount_krw);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [listEntries]);
  const expenseByPaymentMethod = useMemo(() => {
    const map = new Map<LedgerPaymentMethod, number>();
    for (const method of LEDGER_PAYMENT_METHODS) map.set(method, 0);
    for (const e of listEntries) {
      if (e.direction !== 'expense') continue;
      const method = normalizeLedgerPaymentMethod(e.payment_method);
      map.set(method, (map.get(method) ?? 0) + e.amount_krw);
    }
    return LEDGER_PAYMENT_METHODS.map((method) => ({
      method,
      amount: map.get(method) ?? 0,
      ratio: monthSummary.expense > 0 ? ((map.get(method) ?? 0) / monthSummary.expense) * 100 : 0,
    })).sort((a, b) => b.amount - a.amount);
  }, [listEntries, monthSummary.expense]);
  const paymentMethodIcon = (method: LedgerPaymentMethod) => {
    switch (method) {
      case 'card':
        return <CreditCard size={14} strokeWidth={1.8} aria-hidden />;
      case 'cash':
        return <Banknote size={14} strokeWidth={1.8} aria-hidden />;
      case 'gift':
        return <Gift size={14} strokeWidth={1.8} aria-hidden />;
      case 'gglocal':
        return <Ticket size={14} strokeWidth={1.8} aria-hidden />;
      default:
        return <Ellipsis size={14} strokeWidth={1.8} aria-hidden />;
    }
  };

  const [occurredOn, setOccurredOn] = useState(() => defaultDateForView(new Date().getFullYear(), new Date().getMonth() + 1));
  const [direction, setDirection] = useState<LedgerDirection>('expense');
  const [amountRaw, setAmountRaw] = useState('');
  const [category, setCategory] = useState<LedgerCategorySlug>('food');
  const [paymentMethod, setPaymentMethod] = useState<LedgerPaymentMethod>('other');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showExpenseChart, setShowExpenseChart] = useState(false);
  const [expenseChartRange, setExpenseChartRange] = useState<'month' | 'threeMonths'>('month');
  const [entryEditorOpen, setEntryEditorOpen] = useState(false);

  useEffect(() => {
    if (editingId && !entries.some((e) => e.id === editingId)) setEditingId(null);
  }, [entries, editingId]);

  useEffect(() => {
    if (!occurredOnPrefill || !/^\d{4}-\d{2}-\d{2}$/.test(occurredOnPrefill)) return;
    setOccurredOn(occurredOnPrefill);
    setEditingId(null);
    setEntryEditorOpen(true);
    onOccurredOnPrefillConsumed?.();
  }, [occurredOnPrefill, onOccurredOnPrefillConsumed]);

  const ledgerViewMountRef = useRef(false);
  useEffect(() => {
    if (editingId) return;
    if (!ledgerViewMountRef.current) {
      ledgerViewMountRef.current = true;
      return;
    }
    setOccurredOn(defaultDateForView(viewYear, viewMonth));
  }, [viewYear, viewMonth, editingId]);

  const resetFormForNew = () => {
    setOccurredOn(defaultDateForView(viewYear, viewMonth));
    setDirection('expense');
    setAmountRaw('');
    setCategory('food');
    setPaymentMethod('other');
    setMemo('');
    setEditingId(null);
  };
  const closeEntryEditor = () => {
    setEntryEditorOpen(false);
    resetFormForNew();
  };
  const openEntryEditorForNew = () => {
    resetFormForNew();
    setEntryEditorOpen(true);
  };

  const startEdit = (e: (typeof entries)[number]) => {
    setEditingId(e.id);
    setOccurredOn(e.occurred_on);
    setDirection(e.direction);
    setAmountRaw(String(e.amount_krw));
    setCategory(normalizeLedgerCategory(e.category));
    setPaymentMethod(normalizeLedgerPaymentMethod(e.payment_method));
    setMemo(e.memo ?? '');
    setEntryEditorOpen(true);
  };

  const amountKrw = useMemo(() => {
    const n = parseInt(amountRaw.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? n : NaN;
  }, [amountRaw]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(amountKrw) || amountKrw <= 0) {
      onError(t('ledgerInvalidAmount'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        occurred_on: occurredOn,
        direction,
        amount_krw: amountKrw,
        category,
        memo,
        payment_method: paymentMethod,
      };
      const ok = editingId
        ? await updateEntry(editingId, payload)
        : await addEntry(payload);
      if (ok) {
        closeEntryEditor();
      }
    } finally {
      setSubmitting(false);
    }
  };
  const expenseByPaymentMethodChart = useMemo(() => {
    const map = new Map<LedgerPaymentMethod, number>();
    for (const method of LEDGER_PAYMENT_METHODS) map.set(method, 0);
    const now = new Date(viewYear, viewMonth - 1, 1);
    const minWindow = new Date(viewYear, viewMonth - 3, 1);
    for (const e of entries) {
      if (e.direction !== 'expense') continue;
      const dt = new Date(`${e.occurred_on}T00:00:00`);
      const inRange =
        expenseChartRange === 'month'
          ? e.occurred_on.startsWith(`${viewYear}-${String(viewMonth).padStart(2, '0')}`)
          : dt >= minWindow && dt <= new Date(now.getFullYear(), now.getMonth() + 1, 0);
      if (!inRange) continue;
      const method = normalizeLedgerPaymentMethod(e.payment_method);
      map.set(method, (map.get(method) ?? 0) + e.amount_krw);
    }
    const total = [...map.values()].reduce((acc, v) => acc + v, 0);
    const rows = LEDGER_PAYMENT_METHODS.map((method) => ({
      method,
      amount: map.get(method) ?? 0,
      ratio: total > 0 ? ((map.get(method) ?? 0) / total) * 100 : 0,
    })).sort((a, b) => b.amount - a.amount);
    return { total, rows };
  }, [entries, expenseChartRange, viewMonth, viewYear]);

  const fmtKrw = (n: number) => `${n.toLocaleString('ko-KR')}${t('ledgerWonSuffix')}`;

  const exportMonthCsv = useCallback(() => {
    if (listEntries.length === 0) {
      onError(t('ledgerExportEmpty'));
      return;
    }
    const sorted = [...listEntries].sort((a, b) => {
      const d = a.occurred_on.localeCompare(b.occurred_on);
      if (d !== 0) return d;
      return a.created_at.localeCompare(b.created_at);
    });
    const header = [
      t('ledgerDate'),
      t('ledgerType'),
      t('ledgerAmount'),
      t('ledgerCategory'),
      t('ledgerPaymentMethod'),
      t('ledgerMemo'),
      t('ledgerExportRecordedBy'),
    ].map(csvEscape);
    const lines = [header.join(',')];
    for (const e of sorted) {
      const typeLabel = e.direction === 'income' ? t('ledgerIncome') : t('ledgerExpense');
      const row = [
        e.occurred_on,
        typeLabel,
        String(e.amount_krw),
        formatLedgerCategory(e.category, t),
        formatLedgerPaymentMethod(e.payment_method, t),
        e.memo ?? '',
        getMemberName(e.user_id),
      ].map(csvEscape);
      lines.push(row.join(','));
    }
    const bom = '\uFEFF';
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${viewYear}-${String(viewMonth).padStart(2, '0')}.csv`;
    a.rel = 'noopener';
    a.click();
    URL.revokeObjectURL(url);
  }, [listEntries, t, getMemberName, onError, viewYear, viewMonth]);

  return (
    <section aria-label={t('ledgerTitle')} style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.55, margin: '0 0 14px' }}>{t('ledgerSubtitle')}</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            padding: '10px 8px',
            borderRadius: theme.radiusLg,
            border: theme.border,
            background: highContrast ? '#1a3d2e' : 'color-mix(in srgb, var(--accent-light) 55%, transparent)',
            boxShadow: theme.cardShadow,
          }}
        >
          <div style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 4 }}>{t('ledgerSumIncome')}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: highContrast ? '#86efac' : 'var(--accent)' }}>{fmtKrw(monthSummary.income)}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpenseChartRange('month');
            setShowExpenseChart(true);
          }}
          style={{
            padding: '10px 8px',
            borderRadius: theme.radiusLg,
            border: theme.border,
            background: highContrast ? '#3d1a1a' : 'color-mix(in srgb, #fecaca 35%, var(--bg-card))',
            boxShadow: theme.cardShadow,
            textAlign: 'left',
            cursor: 'pointer',
          }}
          aria-label={t('ledgerOpenExpenseChart')}
          title={t('ledgerOpenExpenseChart')}
        >
          <div style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 4 }}>{t('ledgerSumExpense')}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: highContrast ? '#fca5a5' : '#b91c1c' }}>{fmtKrw(monthSummary.expense)}</div>
        </button>
        <div
          style={{
            padding: '10px 8px',
            borderRadius: theme.radiusLg,
            border: theme.border,
            background: theme.card,
            boxShadow: theme.cardShadow,
          }}
        >
          <div style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 4 }}>{t('ledgerBalance')}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{fmtKrw(monthSummary.balance)}</div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11, color: theme.textSecondary }}>
          {t('ledgerThisMonth')}: {monthSummary.year}.{String(monthSummary.month).padStart(2, '0')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => shiftViewMonth(-1)}
            aria-label={t('ledgerMonthPrevAria')}
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
              background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
              color: theme.textSecondary,
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => shiftViewMonth(1)}
            aria-label={t('ledgerMonthNextAria')}
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
              background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
              color: theme.textSecondary,
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>

      {expenseByCategory.length > 0 ? (
        <div
          role="region"
          aria-labelledby="ledger-expense-by-category-heading"
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: theme.radiusLg,
            border: highContrast ? '1px solid #ffc107' : theme.border,
            background: highContrast ? '#1e1e1e' : 'color-mix(in srgb, #fecaca 12%, var(--bg-card))',
            boxShadow: highContrast ? 'none' : theme.cardShadow,
          }}
        >
          <div
            id="ledger-expense-by-category-heading"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: highContrast ? '#ffc107' : theme.text,
              marginBottom: 8,
            }}
          >
            {t('ledgerExpenseByCategory')}
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {expenseByCategory.map(([cat, amt], i) => (
              <li
                key={cat}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 8,
                  fontSize: 12,
                  color: theme.text,
                  paddingTop: i > 0 ? 8 : 0,
                  borderTop:
                    i > 0
                      ? highContrast
                        ? '1px solid #444'
                        : '1px solid color-mix(in srgb, var(--divider) 70%, transparent 30%)'
                      : undefined,
                }}
              >
                <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{formatLedgerCategory(cat, t)}</span>
                <span style={{ flexShrink: 0, fontWeight: 700, color: highContrast ? '#fca5a5' : '#b91c1c' }}>{fmtKrw(amt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          onClick={openEntryEditorForNew}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--accent)',
            color: 'var(--bg-card)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('ledgerOpenEntryEditor')}
        </button>
      </div>
      {entryEditorOpen ? (
        <>
          <div
            role="presentation"
            onClick={closeEntryEditor}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 57,
            }}
          />
          <div
            role="dialog"
            aria-label={editingId ? t('ledgerEditEntryTitle') : t('ledgerAddEntryTitle')}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(92vw, 440px)',
              maxHeight: '82dvh',
              overflowY: 'auto',
              zIndex: 58,
              borderRadius: 14,
              border: theme.border,
              background: highContrast ? '#141414' : 'var(--bg-card)',
              boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>
                {editingId ? t('ledgerEditEntryTitle') : t('ledgerAddEntryTitle')}
              </div>
              <button
                type="button"
                onClick={closeEntryEditor}
                style={{
                  border: '1px solid var(--divider)',
                  background: 'transparent',
                  color: theme.textSecondary,
                  borderRadius: 8,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {t('ledgerCloseEditor')}
              </button>
            </div>
      <form
        onSubmit={handleSubmit}
        style={{
          padding: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 120px', fontSize: 12 }}>
            <span style={{ display: 'block', color: theme.textSecondary, marginBottom: 4 }}>{t('ledgerDate')}</span>
            <input
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: 10,
                border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
                background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
                color: theme.text,
                fontSize: 14,
              }}
            />
          </label>
          <div style={{ flex: '1 1 160px', fontSize: 12 }}>
            <span style={{ display: 'block', color: theme.textSecondary, marginBottom: 4 }}>{t('ledgerType')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setDirection('expense')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--divider)',
                  background: direction === 'expense' ? (highContrast ? '#450a0a' : '#fee2e2') : 'transparent',
                  color: direction === 'expense' ? (highContrast ? '#fecaca' : '#991b1b') : theme.textSecondary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('ledgerExpense')}
              </button>
              <button
                type="button"
                onClick={() => setDirection('income')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--divider)',
                  background: direction === 'income' ? (highContrast ? '#14532d' : 'var(--accent-light)') : 'transparent',
                  color: direction === 'income' ? (highContrast ? '#86efac' : 'var(--accent)') : theme.textSecondary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('ledgerIncome')}
              </button>
            </div>
          </div>
        </div>
        <label style={{ display: 'block', fontSize: 12, marginBottom: 10 }}>
          <span style={{ display: 'block', color: theme.textSecondary, marginBottom: 4 }}>{t('ledgerAmount')}</span>
          <input
            type="text"
            inputMode="numeric"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value)}
            placeholder={t('ledgerAmountPlaceholder')}
            autoComplete="off"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: 10,
              border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
              background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
              color: theme.text,
              fontSize: 15,
              fontWeight: 600,
            }}
          />
        </label>
        <div style={{ marginBottom: 10 }}>
          <span style={{ display: 'block', fontSize: 12, color: theme.textSecondary, marginBottom: 6 }}>{t('ledgerCategory')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LEDGER_CATEGORY_SLUGS.map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => setCategory(slug)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--divider)',
                  background: category === slug ? 'var(--accent-light)' : 'transparent',
                  color: category === slug ? 'var(--accent)' : theme.textSecondary,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {t(LEDGER_CATEGORY_TKEY[slug])}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <span style={{ display: 'block', fontSize: 12, color: theme.textSecondary, marginBottom: 6 }}>{t('ledgerPaymentMethod')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LEDGER_PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--divider)',
                  background: paymentMethod === method ? 'var(--accent-light)' : 'transparent',
                  color: paymentMethod === method ? 'var(--accent)' : theme.textSecondary,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {t(LEDGER_PAYMENT_METHOD_TKEY[method])}
              </button>
            ))}
          </div>
        </div>
        <label style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
          <span style={{ display: 'block', color: theme.textSecondary, marginBottom: 4 }}>{t('ledgerMemo')}</span>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={t('ledgerMemoPlaceholder')}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: 10,
              border: highContrast ? '1px solid #ffc107' : '1px solid var(--divider)',
              background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
              color: theme.text,
              fontSize: 14,
            }}
          />
        </label>
        {editingId ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={closeEntryEditor}
              style={{
                flex: '0 0 auto',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid var(--divider)',
                background: 'transparent',
                color: theme.text,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('ledgerCloseEditor')}
            </button>
            <button
              type="submit"
              disabled={submitting || loading}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '12px 14px',
                borderRadius: 12,
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--bg-card)',
                fontSize: 15,
                fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
                opacity: submitting ? 0.8 : 1,
              }}
            >
              {submitting ? t('saving') : t('ledgerSaveChanges')}
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={submitting || loading}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--bg-card)',
              fontSize: 15,
              fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.8 : 1,
            }}
          >
            {submitting ? t('saving') : t('ledgerAdd')}
          </button>
        )}
      </form>
          </div>
        </>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.text }}>{t('ledgerRecent')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => exportMonthCsv()}
            disabled={listEntries.length === 0}
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--divider)',
              background: 'transparent',
              color: theme.textSecondary,
              cursor: listEntries.length === 0 ? 'not-allowed' : 'pointer',
              opacity: listEntries.length === 0 ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            aria-label={t('ledgerExportAria')}
          >
            <Download size={14} strokeWidth={1.75} aria-hidden />
            {t('ledgerExportCsv')}
          </button>
          <button
            type="button"
            onClick={() => void loadEntries()}
            disabled={loading}
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--divider)',
              background: 'transparent',
              color: theme.textSecondary,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {t('ledgerRefresh')}
          </button>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <p style={{ fontSize: 13, color: theme.textSecondary }}>{t('ledgerLoading')}</p>
      ) : entries.length === 0 ? (
        <p style={{ fontSize: 13, color: theme.textSecondary }}>{t('ledgerEmpty')}</p>
      ) : listEntries.length === 0 ? (
        <p style={{ fontSize: 13, color: theme.textSecondary }}>{t('ledgerEmptyMonth')}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {listEntries.map((e) => (
            <li
              key={e.id}
              style={{
                padding: '10px 12px',
                borderRadius: theme.radiusLg,
                border: theme.border,
                background: highContrast ? '#1e1e1e' : 'var(--bg-card)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4 }}>
                  {e.occurred_on} · {formatLedgerCategory(e.category, t)} · {formatLedgerPaymentMethod(e.payment_method, t)} · {getMemberName(e.user_id)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: e.direction === 'income' ? 'var(--accent)' : '#b91c1c' }}>
                  {e.direction === 'income' ? '+' : '-'}
                  {fmtKrw(e.amount_krw)}
                </div>
                {e.memo ? <div style={{ fontSize: 12, color: theme.text, marginTop: 4, wordBreak: 'break-word' }}>{e.memo}</div> : null}
              </div>
              <div style={{ display: 'flex', flexShrink: 0, gap: 2 }}>
                <button
                  type="button"
                  onClick={() => startEdit(e)}
                  aria-label={t('edit')}
                  style={{
                    padding: 8,
                    border: 'none',
                    background: 'transparent',
                    color: theme.textSecondary,
                    cursor: 'pointer',
                    borderRadius: 8,
                  }}
                >
                  <Pencil size={18} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && !window.confirm(t('ledgerDeleteConfirm'))) return;
                    void deleteEntry(e.id);
                  }}
                  aria-label={t('delete')}
                  style={{
                    padding: 8,
                    border: 'none',
                    background: 'transparent',
                    color: theme.textSecondary,
                    cursor: 'pointer',
                    borderRadius: 8,
                  }}
                >
                  <Trash2 size={18} strokeWidth={1.5} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {showExpenseChart ? (
        <>
          <div
            role="presentation"
            onClick={() => setShowExpenseChart(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 55,
            }}
          />
          <div
            role="dialog"
            aria-label={t('ledgerExpenseChartTitle')}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(92vw, 420px)',
              maxHeight: '78dvh',
              overflowY: 'auto',
              borderRadius: 14,
              border: theme.border,
              background: highContrast ? '#141414' : 'var(--bg-card)',
              boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
              zIndex: 56,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>{t('ledgerExpenseChartTitle')}</div>
              <button
                type="button"
                onClick={() => setShowExpenseChart(false)}
                style={{
                  border: '1px solid var(--divider)',
                  background: 'transparent',
                  color: theme.textSecondary,
                  borderRadius: 8,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {t('close')}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => setExpenseChartRange('month')}
                style={{
                  padding: '5px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--divider)',
                  background: expenseChartRange === 'month' ? 'var(--accent-light)' : 'transparent',
                  color: expenseChartRange === 'month' ? 'var(--accent)' : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('ledgerChartRangeMonth')}
              </button>
              <button
                type="button"
                onClick={() => setExpenseChartRange('threeMonths')}
                style={{
                  padding: '5px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--divider)',
                  background: expenseChartRange === 'threeMonths' ? 'var(--accent-light)' : 'transparent',
                  color: expenseChartRange === 'threeMonths' ? 'var(--accent)' : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('ledgerChartRangeThreeMonths')}
              </button>
            </div>
            <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 10 }}>
              {t('ledgerSumExpense')}: <strong style={{ color: theme.text }}>{fmtKrw(expenseByPaymentMethodChart.total)}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {expenseByPaymentMethodChart.rows.map(({ method, amount, ratio }) => (
                <div key={method} style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: theme.text }}>
                      {paymentMethodIcon(method)}
                      {t(LEDGER_PAYMENT_METHOD_TKEY[method])}
                    </span>
                    <span style={{ color: theme.textSecondary }}>
                      {fmtKrw(amount)} · {ratio.toFixed(0)}%
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 8,
                      borderRadius: 999,
                      background: highContrast ? '#2a2a2a' : 'var(--bg-subtle)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(0, Math.min(100, ratio))}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
