'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/app/api/supabaseClient';
import { LOG_SLUG } from '@/lib/logTags';
import type { TodoTask } from '@/components/home/TodoBoard';

type UseTodoSnapshotsArgs = {
  householdId: string | null;
  userId: string | null | undefined;
  todoTasks: TodoTask[];
  setTodoTasks: React.Dispatch<React.SetStateAction<TodoTask[]>>;
  todoSnapshotPrefix: string;
  parseTodoSnapshot: (action: string | null | undefined) => TodoTask[] | null;
  composeTodoSnapshot: (tasks: TodoTask[]) => string;
};

export function useTodoSnapshots({
  householdId,
  userId,
  todoTasks,
  setTodoTasks,
  todoSnapshotPrefix,
  parseTodoSnapshot,
  composeTodoSnapshot,
}: UseTodoSnapshotsArgs) {
  const todoSnapshotHydratedRef = useRef(false);
  const lastLoadedTodoSnapshotActionRef = useRef('');
  const lastSavedTodoSnapshotActionRef = useRef('');
  const todoDirtyRef = useRef(false);
  const loadReqSeqRef = useRef(0);

  const applyRemoteTodoSnapshot = (latestAction: string) => {
    if (!latestAction || latestAction === lastLoadedTodoSnapshotActionRef.current) return;
    const parsed = parseTodoSnapshot(latestAction);
    if (parsed && !todoDirtyRef.current) {
      lastLoadedTodoSnapshotActionRef.current = latestAction;
      lastSavedTodoSnapshotActionRef.current = latestAction;
      setTodoTasks(parsed);
    }
  };

  const refreshTodoSnapshot = async () => {
    if (!householdId || !userId) return;
    const reqSeq = ++loadReqSeqRef.current;
    const { data } = await supabase
      .from('logs')
      .select('action, created_at')
      .eq('household_id', householdId)
      .eq('actor_user_id', userId)
      .like('action', `${todoSnapshotPrefix}%`)
      .order('created_at', { ascending: false })
      .limit(1);
    if (reqSeq !== loadReqSeqRef.current) return;
    const latestAction = typeof data?.[0]?.action === 'string' ? data[0].action : '';
    todoSnapshotHydratedRef.current = true;
    applyRemoteTodoSnapshot(latestAction);
  };

  useEffect(() => {
    if (!householdId || !userId) return;
    let cancelled = false;
    const loadTodo = async () => {
      await refreshTodoSnapshot();
      if (cancelled) return;
    };
    void loadTodo();
    const timer = window.setInterval(() => {
      void loadTodo();
    }, 7000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [householdId, userId, todoSnapshotPrefix, parseTodoSnapshot, setTodoTasks]);

  useEffect(() => {
    if (!householdId || !userId) return;
    if (!todoSnapshotHydratedRef.current) return;
    const action = composeTodoSnapshot(todoTasks);
    if (action === lastSavedTodoSnapshotActionRef.current) return;
    const timer = window.setTimeout(async () => {
      const { error } = await supabase.from('logs').insert({
        household_id: householdId,
        place_slug: LOG_SLUG.todo,
        action,
        actor_user_id: userId,
      });
      if (!error) {
        lastSavedTodoSnapshotActionRef.current = action;
        todoDirtyRef.current = false;
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [todoTasks, householdId, userId, composeTodoSnapshot]);

  const markTodoDirty = () => {
    todoDirtyRef.current = true;
  };

  return {
    markTodoDirty,
    applyRemoteTodoSnapshot,
    refreshTodoSnapshot,
  };
}
