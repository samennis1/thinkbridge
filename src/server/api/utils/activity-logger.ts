import { type MySql2Database } from 'drizzle-orm/mysql2';
import { activities } from '~/server/db/schema';
import type * as schema from '~/server/db/schema';
import { type ActionType, type EntityType } from '~/types/activity';

export async function logActivity({
  db,
  userId,
  projectId,
  actionType,
  entityId,
  entityType,
  details = {},
}: {
  db: MySql2Database<typeof schema>;
  userId: string;
  projectId: number;
  actionType: ActionType;
  entityId: number;
  entityType: EntityType;
  details?: Record<string, unknown>;
}) {
  try {
    await db.insert(activities).values({
      userId,
      projectId,
      actionType,
      entityId,
      entityType,
      details: JSON.stringify(details),
    });
    
    return true;
  } catch (error) {
    console.error("Failed to log activity:", error instanceof Error ? error.message : String(error));
    return false;
  }
} 