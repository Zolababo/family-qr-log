'use client';

import { useState, useCallback } from 'react';
import { CheckSquare2, Plus, RotateCcw, Trash2 } from 'lucide-react';

export type TodoPriorityKey = 'urgentImportant' | 'notUrgentImportant' | 'urgentNotImportant' | 'notUrgentNotImportant';
export type TodoTask = {
  id: number;
  text: string;
  key: TodoPriorityKey;
  done: boolean;
  createdAt: string;
  completedAt: string | null;
  /** YYYY-MM-DD, optional */
  dueDate: string | null;
};
export type TodoPeriod = 'day' | 'week' | 'month';

const TODO_PERIOD_OPTIONS: TodoPeriod[] = ['day', 'week', 'month'];

/** 순서: 좌상(Q1) → 우상(Q2) → 좌하(Q3) → 우하(Q4). 제목만으로 축 구분. */
const MATRIX: { key: TodoPriorityKey; titleKey: string; accent: string }[] = [
  { key: 'urgentImportant', titleKey: 'todoQuadrantUrgentImportant', accent: 'rgba(220, 38, 38, 0.12)' },
  { key: 'notUrgentImportant', titleKey: 'todoQuadrantNotUrgentImportant', accent: 'rgba(22, 163, 74, 0.14)' },
  { key: 'urgentNotImportant', titleKey: 'todoQuadrantUrgentNotImportant', accent: 'rgba(234, 179, 8, 0.16)' },
  { key: 'notUrgentNotImportant', titleKey: 'todoQuadrantNotUrgentNotImportant', accent: 'rgba(100, 116, 139, 0.14)' },
];

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type TodoBoardProps = {
  highContrast: boolean;
  todoCompletedPeriod: TodoPeriod;
  setTodoCompletedPeriod: (v: TodoPeriod) => void;
  todoActiveByGroup: Record<TodoPriorityKey, TodoTask[]>;
  todoCompletedGroups: Array<[string, TodoTask[]]>;
  addTodoTask: (key: TodoPriorityKey, text: string, dueDate?: string | null) => void;
  toggleTodoTaskDone: (id: number) => void;
  removeTodoTask: (id: number) => void;
  t: (key: string) => string;
};

const emptyDrafts = (): Record<TodoPriorityKey, string> => ({
  urgentImportant: '',
  notUrgentImportant: '',
  urgentNotImportant: '',
  notUrgentNotImportant: '',
});

export function TodoBoard({
  highContrast,
  todoCompletedPeriod,
  setTodoCompletedPeriod,
  todoActiveByGroup,
  todoCompletedGroups,
  addTodoTask,
  toggleTodoTaskDone,
  removeTodoTask,
  t,
}: TodoBoardProps) {
  const [draftByKey, setDraftByKey] = useState<Record<TodoPriorityKey, string>>(emptyDrafts);
  const [draftDueByKey, setDraftDueByKey] = useState<Record<TodoPriorityKey, string>>(emptyDrafts);

  const commitDraft = useCallback(
    (key: TodoPriorityKey) => {
      const raw = (draftByKey[key] ?? '').trim();
      if (!raw) return;
      const dueRaw = (draftDueByKey[key] ?? '').trim();
      const dueDate = dueRaw && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null;
      addTodoTask(key, raw, dueDate);
      setDraftByKey((prev) => ({ ...prev, [key]: '' }));
      setDraftDueByKey((prev) => ({ ...prev, [key]: '' }));
    },
    [addTodoTask, draftByKey, draftDueByKey]
  );

  const renderQuadrant = (meta: (typeof MATRIX)[number]) => {
    const { key, titleKey, accent } = meta;
    const title = t(titleKey);
    const tasks = todoActiveByGroup[key];
    const border = highContrast ? '1px solid #444' : '1px solid var(--divider)';
    return (
      <div
        key={key}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          minHeight: 0,
          borderRadius: 12,
          border,
          background: highContrast ? `linear-gradient(180deg, ${accent}, #121212 40%)` : `linear-gradient(180deg, ${accent}, var(--bg-card) 35%)`,
          padding: '9px 10px 8px',
          height: '100%',
        }}
      >
        <div style={{ marginBottom: 6, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a', lineHeight: 1.25 }}>{title}</div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            maxHeight: 'none',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            marginBottom: 6,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {tasks.length === 0 ? (
            <div style={{ fontSize: 11, color: highContrast ? '#94a3b8' : 'var(--text-caption)', padding: '4px 0' }}>{t('todoEmptyQuadrant')}</div>
          ) : (
            tasks.map((task, idx) => {
              const overdue = Boolean(task.dueDate && task.dueDate < todayIsoDate());
              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    padding: '6px 0',
                    borderBottom: idx < tasks.length - 1 ? (highContrast ? '1px solid #333' : '1px solid var(--divider)') : 'none',
                    fontSize: 12,
                    color: highContrast ? '#e2e8f0' : 'var(--text-primary)',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35, wordBreak: 'break-word' }}>
                    {task.text}
                    {task.dueDate ? (
                      <span
                        style={{
                          display: 'block',
                          fontSize: 10,
                          marginTop: 3,
                          fontWeight: 600,
                          color: overdue ? (highContrast ? '#f87171' : '#dc2626') : highContrast ? '#94a3b8' : 'var(--text-secondary)',
                        }}
                      >
                        {t('todoDueLabel')}: {task.dueDate.replace(/-/g, '.')}
                        {overdue ? ` · ${t('todoOverdue')}` : ''}
                      </span>
                    ) : null}
                  </span>
                  <button type="button" onClick={() => toggleTodoTaskDone(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: highContrast ? '#ffc107' : '#16a34a', flexShrink: 0 }} aria-label={t('todoAriaComplete')}>
                    <CheckSquare2 size={16} strokeWidth={1.75} aria-hidden />
                  </button>
                  <button type="button" onClick={() => removeTodoTask(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: highContrast ? '#f87171' : '#ef4444', flexShrink: 0 }} aria-label={t('todoAriaDelete')}>
                    <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commitDraft(key);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, marginTop: 'auto', minWidth: 0 }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
            <label style={{ flex: '0 0 auto', fontSize: 10, color: highContrast ? '#94a3b8' : 'var(--text-secondary)', whiteSpace: 'nowrap' }} htmlFor={`todo-due-${key}`}>
              {t('todoDueLabel')}
            </label>
            <input
              id={`todo-due-${key}`}
              type="date"
              value={draftDueByKey[key]}
              onChange={(e) => setDraftDueByKey((prev) => ({ ...prev, [key]: e.target.value }))}
              aria-label={t('todoDueDateAria')}
              style={{
                flex: '1 1 120px',
                minWidth: 0,
                maxWidth: '100%',
                borderRadius: 8,
                border: highContrast ? '1px solid #555' : '1px solid var(--divider)',
                padding: '6px 8px',
                fontSize: 11,
                background: highContrast ? '#0c0c0c' : 'var(--bg-subtle)',
                color: highContrast ? '#fff' : 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
            <input
              type="text"
              value={draftByKey[key]}
              onChange={(e) => setDraftByKey((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={t('todoAddPlaceholder')}
              aria-label={`${title} ${t('todoAddAria')}`}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: 8,
                border: highContrast ? '1px solid #555' : '1px solid var(--divider)',
                padding: '8px 10px',
                fontSize: 12,
                background: highContrast ? '#0c0c0c' : 'var(--bg-subtle)',
                color: highContrast ? '#fff' : 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              style={{
                border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
                borderRadius: 8,
                background: highContrast ? '#1e1e1e' : '#fff',
                color: highContrast ? '#fff' : '#334155',
                padding: '0 10px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label={`${title} ${t('todoSubmitAria')}`}
            >
              <Plus size={18} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <section aria-label={t('todoBoardAria')} style={{ marginBottom: 20, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: highContrast ? '#fff' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckSquare2 size={18} strokeWidth={1.5} aria-hidden />
          {t('todoBoardTitle')}
        </h3>
      </div>

      <div className="todo-eisenhower-grid" style={{ marginBottom: 12, height: 'min(52vh, 580px)' }}>
        {MATRIX.map((m) => renderQuadrant(m))}
      </div>

      <div style={{ border: highContrast ? '1px solid #333' : '1px solid var(--divider)', borderRadius: 12, padding: 10, background: highContrast ? '#121212' : 'var(--bg-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: highContrast ? '#fff' : 'var(--text-secondary)' }}>{t('todoCompletedTitle')}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {TODO_PERIOD_OPTIONS.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setTodoCompletedPeriod(period)}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 999,
                  border: todoCompletedPeriod === period ? '1px solid var(--accent)' : '1px solid var(--divider)',
                  background: todoCompletedPeriod === period ? 'var(--accent-light)' : 'var(--bg-card)',
                  color: todoCompletedPeriod === period ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {period === 'day' ? t('todoPeriodDay') : period === 'week' ? t('todoPeriodWeek') : t('todoPeriodMonth')}
              </button>
            ))}
          </div>
        </div>
        {todoCompletedGroups.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-caption)' }}>{t('todoCompletedEmpty')}</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {todoCompletedGroups.map(([label, tasks]) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: highContrast ? '#e5e7eb' : 'var(--text-secondary)', marginBottom: 3 }}>{label}</div>
                {tasks.map((task) => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0' }}>
                    <span style={{ flex: 1, fontSize: 12, color: highContrast ? '#d1d5db' : 'var(--text-secondary)' }}>
                      {task.text}
                      {task.dueDate ? (
                        <span style={{ display: 'block', fontSize: 10, marginTop: 2, opacity: 0.9 }}>
                          {t('todoDueLabel')}: {task.dueDate.replace(/-/g, '.')}
                        </span>
                      ) : null}
                    </span>
                    <button type="button" onClick={() => toggleTodoTaskDone(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: highContrast ? '#ffc107' : 'var(--accent)' }} aria-label={t('todoAriaRestore')}>
                      <RotateCcw size={15} strokeWidth={1.75} aria-hidden />
                    </button>
                    <button type="button" onClick={() => removeTodoTask(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: highContrast ? '#f87171' : '#ef4444' }} aria-label={t('todoAriaDelete')}>
                      <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
