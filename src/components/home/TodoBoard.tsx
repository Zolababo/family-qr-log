'use client';

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
const TODO_GROUPS: { key: TodoPriorityKey; label: string }[] = [
  { key: 'urgentImportant', label: '⚡ 중요하고 긴급' },
  { key: 'notUrgentImportant', label: '💡 중요하지만 여유' },
  { key: 'urgentNotImportant', label: '🔔 덜 중요하나 긴급' },
  { key: 'notUrgentNotImportant', label: '💤 덜 중요하고 여유' },
];

type TodoBoardProps = {
  highContrast: boolean;
  todoInput: string;
  setTodoInput: (v: string) => void;
  todoKey: TodoPriorityKey;
  setTodoKey: (v: TodoPriorityKey) => void;
  todoCompletedPeriod: TodoPeriod;
  setTodoCompletedPeriod: (v: TodoPeriod) => void;
  todoActiveByGroup: Record<TodoPriorityKey, TodoTask[]>;
  todoCompletedGroups: Array<[string, TodoTask[]]>;
  addTodoTask: () => void;
  toggleTodoTaskDone: (id: number) => void;
  removeTodoTask: (id: number) => void;
};

export function TodoBoard({
  highContrast,
  todoInput,
  setTodoInput,
  todoKey,
  setTodoKey,
  todoCompletedPeriod,
  setTodoCompletedPeriod,
  todoActiveByGroup,
  todoCompletedGroups,
  addTodoTask,
  toggleTodoTaskDone,
  removeTodoTask,
}: TodoBoardProps) {
  return (
    <section aria-label="할 일 목록" style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: highContrast ? '#fff' : '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckSquare2 size={18} strokeWidth={1.5} aria-hidden />
          할 일 목록
        </h3>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: highContrast ? '#94a3b8' : '#64748b' }}>
          중요도/긴급도 기준으로 관리
        </p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          type="text"
          value={todoInput}
          onChange={(e) => setTodoInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addTodoTask();
          }}
          placeholder="할 일을 입력하세요"
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: 10,
            border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
            padding: '10px 12px',
            fontSize: 13,
            background: highContrast ? '#0f0f0f' : '#f8fafc',
            color: highContrast ? '#fff' : '#0f172a',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={addTodoTask}
          style={{
            border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
            borderRadius: 10,
            background: highContrast ? '#1e1e1e' : '#fff',
            color: highContrast ? '#fff' : '#334155',
            padding: '0 10px',
            fontSize: 16,
            cursor: 'pointer',
          }}
          aria-label="추가"
        >
          <Plus size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <select
        value={todoKey}
        onChange={(e) => setTodoKey(e.target.value as TodoPriorityKey)}
        style={{
          width: '100%',
          marginBottom: 10,
          borderRadius: 10,
          border: highContrast ? '1px solid #ffc107' : '1px solid #e2e8f0',
          padding: '8px 10px',
          fontSize: 12,
          background: highContrast ? '#0f0f0f' : '#f8fafc',
          color: highContrast ? '#fff' : '#0f172a',
        }}
      >
        {TODO_GROUPS.map((g) => (
          <option key={g.key} value={g.key}>
            {g.label}
          </option>
        ))}
      </select>
      <div style={{ display: 'grid', gap: 8 }}>
        {TODO_GROUPS.map((group) => (
          <div key={group.key} style={{ border: highContrast ? '1px solid #333' : '1px solid #e2e8f0', borderRadius: 10, padding: 8, background: highContrast ? '#121212' : '#f8fafc' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: highContrast ? '#fff' : '#334155' }}>{group.label}</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {todoActiveByGroup[group.key].length === 0 ? (
                <div style={{ fontSize: 11, color: '#94a3b8' }}>비어 있음</div>
              ) : (
                todoActiveByGroup[group.key].map((task) => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: highContrast ? '#1a1a1a' : '#fff', border: highContrast ? '1px solid #333' : '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px' }}>
                    <span style={{ flex: 1, fontSize: 12, color: highContrast ? '#fff' : '#0f172a' }}>{task.text}</span>
                    <button type="button" onClick={() => toggleTodoTaskDone(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: highContrast ? '#ffc107' : '#16a34a' }} aria-label="완료">
                      <CheckSquare2 size={16} strokeWidth={1.75} aria-hidden />
                    </button>
                    <button type="button" onClick={() => removeTodoTask(task.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: highContrast ? '#f87171' : '#ef4444' }} aria-label="삭제">
                      <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
        <div style={{ border: highContrast ? '1px solid #333' : '1px solid #e2e8f0', borderRadius: 10, padding: 8, background: highContrast ? '#121212' : '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: highContrast ? '#fff' : '#334155' }}>✅ 완료된 항목</div>
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
      </div>
    </section>
  );
}
