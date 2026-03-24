'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { CheckSquare2, Plus, RotateCcw, Trash2 } from 'lucide-react';

export type TodoPriorityKey = 'urgentImportant' | 'notUrgentImportant' | 'urgentNotImportant' | 'notUrgentNotImportant';
export type TodoTask = {
  id: number;
  text: string;
  key: TodoPriorityKey;
  done: boolean;
  createdAt: string;
  completedAt: string | null;
};
export type TodoPeriod = 'day' | 'week' | 'month';

const TODO_PERIOD_OPTIONS: TodoPeriod[] = ['day', 'week', 'month'];

/** 순서: 좌상(Q1) → 우상(Q2) → 좌하(Q3) → 우하(Q4). 제목만으로 축 구분. */
const MATRIX: { key: TodoPriorityKey; title: string; accent: string }[] = [
  { key: 'urgentImportant', title: '긴급 · 중요', accent: 'rgba(220, 38, 38, 0.12)' },
  { key: 'notUrgentImportant', title: '중요 · 여유', accent: 'rgba(22, 163, 74, 0.14)' },
  { key: 'urgentNotImportant', title: '긴급 · 덜중요', accent: 'rgba(234, 179, 8, 0.16)' },
  { key: 'notUrgentNotImportant', title: '여유 · 덜중요', accent: 'rgba(100, 116, 139, 0.14)' },
];

type TodoBoardProps = {
  highContrast: boolean;
  todoCompletedPeriod: TodoPeriod;
  setTodoCompletedPeriod: (v: TodoPeriod) => void;
  todoActiveByGroup: Record<TodoPriorityKey, TodoTask[]>;
  todoCompletedGroups: Array<[string, TodoTask[]]>;
  addTodoTask: (key: TodoPriorityKey, text: string) => void;
  toggleTodoTaskDone: (id: number) => void;
  removeTodoTask: (id: number) => void;
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
}: TodoBoardProps) {
  const [draftByKey, setDraftByKey] = useState<Record<TodoPriorityKey, string>>(emptyDrafts);
  const draftRef = useRef(draftByKey);
  useEffect(() => {
    draftRef.current = draftByKey;
  }, [draftByKey]);

  const commitDraft = useCallback(
    (key: TodoPriorityKey) => {
      const raw = draftRef.current[key]?.trim();
      if (!raw) return;
      addTodoTask(key, raw);
      setDraftByKey((prev) => ({ ...prev, [key]: '' }));
    },
    [addTodoTask]
  );

  const renderQuadrant = (meta: (typeof MATRIX)[number]) => {
    const { key, title, accent } = meta;
    const tasks = todoActiveByGroup[key];
    const border = highContrast ? '1px solid #444' : '1px solid #e2e8f0';
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
          background: highContrast ? `linear-gradient(180deg, ${accent}, #121212 40%)` : `linear-gradient(180deg, ${accent}, #fff 35%)`,
          padding: '7px 8px 6px',
        }}
      >
        <div style={{ marginBottom: 6, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a', lineHeight: 1.25 }}>{title}</div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            maxHeight: 'min(28vh, 200px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            marginBottom: 6,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {tasks.length === 0 ? (
            <div style={{ fontSize: 11, color: highContrast ? '#64748b' : '#94a3b8', padding: '4px 0' }}>항목 없음</div>
          ) : (
            tasks.map((task, idx) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 0',
                  borderBottom: idx < tasks.length - 1 ? (highContrast ? '1px solid #333' : '1px solid #f1f5f9') : 'none',
                  fontSize: 12,
                  color: highContrast ? '#e2e8f0' : '#0f172a',
                }}
              >
                <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35, wordBreak: 'break-word' }}>{task.text}</span>
                <button type="button" onClick={() => toggleTodoTaskDone(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: highContrast ? '#ffc107' : '#16a34a', flexShrink: 0 }} aria-label="완료">
                  <CheckSquare2 size={16} strokeWidth={1.75} aria-hidden />
                </button>
                <button type="button" onClick={() => removeTodoTask(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: highContrast ? '#f87171' : '#ef4444', flexShrink: 0 }} aria-label="삭제">
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 'auto', minWidth: 0 }}>
          <input
            type="text"
            value={draftByKey[key]}
            onChange={(e) => setDraftByKey((prev) => ({ ...prev, [key]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft(key);
            }}
            placeholder="추가…"
            aria-label={`${title} 할 일 입력`}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 8,
              border: highContrast ? '1px solid #555' : '1px solid #e2e8f0',
              padding: '8px 10px',
              fontSize: 12,
              background: highContrast ? '#0c0c0c' : '#f8fafc',
              color: highContrast ? '#fff' : '#0f172a',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => commitDraft(key)}
            style={{
              border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
              borderRadius: 8,
              background: highContrast ? '#1e1e1e' : '#fff',
              color: highContrast ? '#fff' : '#334155',
              padding: '0 10px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label={`${title}에 추가`}
          >
            <Plus size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    );
  };

  return (
    <section aria-label="할 일 목록" style={{ marginBottom: 20, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckSquare2 size={18} strokeWidth={1.5} aria-hidden />
          할 일
        </h3>
      </div>

      <div className="todo-eisenhower-grid" style={{ marginBottom: 12 }}>
        {MATRIX.map((m) => renderQuadrant(m))}
      </div>

      <div style={{ border: highContrast ? '1px solid #333' : '1px solid #e2e8f0', borderRadius: 12, padding: 10, background: highContrast ? '#121212' : '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: highContrast ? '#fff' : '#334155' }}>완료된 항목</div>
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
                  border: todoCompletedPeriod === period ? '1px solid var(--accent)' : '1px solid #e2e8f0',
                  background: todoCompletedPeriod === period ? 'var(--accent-light)' : '#fff',
                  color: todoCompletedPeriod === period ? 'var(--accent)' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {period === 'day' ? '일별' : period === 'week' ? '주별' : '월별'}
              </button>
            ))}
          </div>
        </div>
        {todoCompletedGroups.length === 0 ? (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>완료 항목 없음</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {todoCompletedGroups.map(([label, tasks]) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: highContrast ? '#e5e7eb' : '#475569', marginBottom: 3 }}>{label}</div>
                {tasks.map((task) => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                    <span style={{ flex: 1, fontSize: 12, color: highContrast ? '#d1d5db' : '#475569' }}>{task.text}</span>
                    <button type="button" onClick={() => toggleTodoTaskDone(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: highContrast ? '#ffc107' : '#0ea5e9' }} aria-label="복원">
                      <RotateCcw size={15} strokeWidth={1.75} aria-hidden />
                    </button>
                    <button type="button" onClick={() => removeTodoTask(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: highContrast ? '#f87171' : '#ef4444' }} aria-label="삭제">
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
