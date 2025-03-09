export type ActionType = 
  | "create_project"
  | "update_project"
  | "create_milestone"
  | "complete_milestone"
  | "create_task"
  | "update_task"
  | "complete_task"
  | "add_document"
  | "add_member"
  | "remove_member"
  | "comment";

export type EntityType = 
  | "project"
  | "milestone"
  | "task"
  | "document"
  | "member";

export interface Activity {
  id: number;
  userId: string;
  projectId: number;
  actionType: ActionType;
  entityId: number;
  entityType: EntityType;
  details: string;
  createdAt: Date;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  };
  project?: {
    id: number;
    name: string;
  };
} 