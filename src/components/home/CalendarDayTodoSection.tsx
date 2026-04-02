'use client';

import { CheckSquare2 } from 'lucide-react';
import type { TodoPriorityKey, TodoTask } from './TodoBoard';

const QUADRANT_TITLE_KEY: Record<TodoPriorityKey, string> = {
  urgentImportant: 'todoQuadrantUrgentImportant',
  notUrgentImportant: 'todoQuadrantNotUrgentImportant',
  urgentNotImportant: 'todoQuadrantUrgentNotImportant',
  notUrgentNotImportant: 'todoQuadrantNotUrgentNotImportant',
};

type Theme = {
  text: string;
  textSecondary: string;
  border: string;
  radiusLg: number;
  card: string;
};

type CalendarDayTodoSectionProps = {
  tasks: TodoTask[];
  t: (key: string) => string;
  theme: Theme;
  highContrast: boolean;
  onOpenTodoTab: () => void;
};

export function CalendarDayTodoSection({ tasks, t, theme, highContrast, onOpenTodoTab }: CalendarDayTodoSectionProps) {
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
          marginBottom: tasks.length > 0 ? 10 : 6,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: theme.text }}>
          <CheckSquare2 size={18} strokeWidth={1.5} aria-hidden />
          {t('todoCalendarDueTitle')}
        </span>
        <button
          type="button"
          onClick={onOpenTodoTab}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: highContrast ? '1px solid #a78bfa' : '1px solid var(--accent)',
            background: highContrast ? '#2e1065' : 'var(--accent-light)',
            color: highContrast ? '#ddd6fe' : 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('todoCalendarDueOpenTab')}
        </button>
      </div>

      {tasks.length === 0 ? (
        <p style={{ fontSize: 12, color: theme.textSecondary, margin: 0, lineHeight: 1.5 }}>{t('todoCalendarDueEmpty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map((task) => (
            <li
              key={task.id}
              style={{
                fontSize: 12,
                padding: '8px 10px',
                borderRadius: 8,
                border: highContrast ? '1px solid #444' : '1px solid var(--divider)',
                background: highContrast ? '#1e1e1e' : 'var(--bg-subtle)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>
                {t(QUADRANT_TITLE_KEY[task.key])}
              </div>
              <div style={{ color: theme.text, wordBreak: 'break-word', lineHeight: 1.35 }}>{task.text}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
