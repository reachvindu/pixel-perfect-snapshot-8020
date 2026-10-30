import type { TaskStatus } from "@/types";

export type AssistantAction = {
  type:
    | "move_task" | "create_task" | "update_task" | "delete_task"
    | "create_list" | "rename_list" | "delete_list"
    | "create_board" | "rename_board" | "delete_board";
  taskId: string | null;
  listId: string | null;
  listName: string | null;
  boardId: string | null;
  boardName: string | null;
  title: string | null;
  owner: string | null;
  deadline: string | null;
  name: string | null;
  status: TaskStatus | null;
};

export type AssistantResult = { reply: string; actions: AssistantAction[] };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Status implied by a list's name, so moving a card to "Completed" also marks it done. */
export function statusForListName(name: string): TaskStatus | null {
  const n = norm(name);
  if (/complete|done|finish/.test(n)) return "done";
  if (/progress|doing|wip/.test(n)) return "in_progress";
  if (/hold|block|paus/.test(n)) return "blocked";
  if (/todo|backlog/.test(n)) return "todo";
  return null;
}

export const sameName = (a: string, b: string) => norm(a) === norm(b);
