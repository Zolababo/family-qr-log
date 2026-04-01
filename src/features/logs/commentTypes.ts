export type LogComment = {
  id: string;
  log_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
};

export type CommentTarget = {
  logId: string;
  parentId: string | null;
};
