'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  LEDGER_CATEGORY_SLUGS,
  useHouseholdLedger,
} from '@/features/ledger/useHouseholdLedger';
import {
  LEDGER_CATEGORY_TKEY,
  formatLedgerCategory,
  normalizeLedgerCategory,
} from '@/features/ledger/ledgerCategoryLabels';
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
};

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function LedgerPanel({ ledger, getMemberName, onError, t, theme, highContrast }: LedgerPanelProps) {
  const { entries, loading, loadEntries, addEntry, updateEntry, deleteEntry, monthSummary } = ledger;

  const [occurredOn, setOccurredOn] = useState(todayIsoDate);
  const [direction, setDirection] = useState<LedgerDirection>('expense');
  const [amountRaw, setAmountRaw] = useState('');
  const [category, setCategory] = useState<LedgerCategorySlug>('food');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (editingId && !entries.some((e) => e.id === editingId)) setEditingId(null);
  }, [entries, editingId]);

  const resetFormForNew = () => {
    setOccurredOn(todayIsoDate());
    setDirection('expense');
    setAmountRaw('');
    setCategory('food');
    setMemo('');
    setEditingId(null);
  };

  const startEdit = (e: (typeof entries)[number]) => {
    setEditingId(e.id);
    setOccurredOn(e.occurred_on);
    setDirection(e.direction);
    setAmountRaw(String(e.amount_krw));
    setCategory(normalizeLedgerCategory(e.category));
    setMemo(e.memo ?? '');
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
      };
      const ok = editingId
        ? await updateEntry(editingId, payload)
        : await addEntry(payload);
      if (ok) {
        if (editingId) {
          resetFormForNew();
        } else {
          setAmountRaw('');
          setMemo('');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fmtKrw = (n: number) => `${n.toLocaleString('ko-KR')}${t('ledgerWonSuffix')}`;

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
        <div
          style={{
            padding: '10px 8px',
            borderRadius: theme.radiusLg,
            border: theme.border,
            background: highContrast ? '#3d1a1a' : 'color-mix(in srgb, #fecaca 35%, var(--bg-card))',
            boxShadow: theme.cardShadow,
          }}
        >
          <div style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 4 }}>{t('ledgerSumExpense')}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: highContrast ? '#fca5a5' : '#b91c1c' }}>{fmtKrw(monthSummary.expense)}</div>
        </div>
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
      <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 12 }}>
        {t('ledgerThisMonth')}: {monthSummary.year}.{String(monthSummary.month).padStart(2, '0')}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: theme.radiusLg,
          border: theme.border,
          background: theme.card,
          boxShadow: theme.cardShadow,
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
              onClick={() => resetFormForNew()}
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
              {t('ledgerCancelEdit')}
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.text }}>{t('ledgerRecent')}</h2>
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

      {loading && entries.length === 0 ? (
        <p style={{ fontSize: 13, color: theme.textSecondary }}>{t('ledgerLoading')}</p>
      ) : entries.length === 0 ? (
        <p style={{ fontSize: 13, color: theme.textSecondary }}>{t('ledgerEmpty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((e) => (
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
                  {e.occurred_on} · {formatLedgerCategory(e.category, t)} · {getMemberName(e.user_id)}
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
    </section>
  );
}
