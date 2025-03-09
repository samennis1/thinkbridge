import { relations, sql } from "drizzle-orm";
import {
  bigint,
  index,
  int,
  mysqlTableCreator,
  primaryKey,
  text,
  timestamp,
  varchar,
  mysqlEnum as enumType,
} from "drizzle-orm/mysql-core";
import { type AdapterAccount } from "next-auth/adapters";

export const createTable = mysqlTableCreator((name) => `thinkhub_${name}`);

export const posts = createTable(
  "post",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    name: varchar("name", { length: 256 }),
    createdById: varchar("created_by", { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (example) => ({
    createdByIdIdx: index("created_by_idx").on(example.createdById),
    nameIndex: index("name_idx").on(example.name),
  }),
);

export const users = createTable("user", {
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    fsp: 3,
  }).default(sql`CURRENT_TIMESTAMP(3)`),
  image: varchar("image", { length: 255 }),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accounts = createTable(
  "account",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("account_user_id_idx").on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("session_token", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_user_id_idx").on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const projects = createTable("project", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: varchar("created_by", { length: 255 })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const projectMembers = createTable("project_member", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id")
    .notNull()
    .references(() => projects.id),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id),
  role: enumType("role", ["Manager", "Researcher", "Viewer"]).notNull(),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`),
});

export const milestones = createTable("milestone", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id")
    .notNull()
    .references(() => projects.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: timestamp("due_date").notNull(),
  status: enumType("status", ["Planned", "In Progress", "Completed"]),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const tasks = createTable("task", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id")
    .notNull()
    .references(() => projects.id),
  milestoneId: int("milestone_id").references(() => milestones.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: enumType("status", ["To Do", "In Progress", "Completed"]),
  createdBy: varchar("created_by", { length: 255 })
    .notNull()
    .references(() => users.id),
  assignedTo: varchar("assigned_to", { length: 255 }).references(
    () => users.id,
  ),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  documentId: int("document_id").references(() => documents.id),
  priority: enumType("priority", ["1", "2", "3", "4", "5"]),
  policyHeader: varchar("policy_header", { length: 255 }),
  policyContent: text("policy_content"),
  recommendedContent: text("recommended_content"),
  order: int("order").notNull(),
});

export const documents = createTable("document", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id")
    .notNull()
    .references(() => projects.id),
  uploadedBy: varchar("uploaded_by", { length: 255 })
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  fileUrl: varchar("file_url", { length: 255 }),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const activities = createTable("activity", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id),
  projectId: int("project_id")
    .notNull()
    .references(() => projects.id),
  actionType: enumType("action_type", [
    "create_project",
    "update_project",
    "create_milestone",
    "complete_milestone",
    "create_task",
    "update_task",
    "complete_task",
    "add_document",
    "add_member",
    "remove_member",
    "comment"
  ]).notNull(),
  entityId: int("entity_id"),
  entityType: enumType("entity_type", ["project", "milestone", "task", "document", "member"]).notNull(),
  details: text("details"),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, { fields: [activities.userId], references: [users.id] }),
  project: one(projects, { fields: [activities.projectId], references: [projects.id] }),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  members: many(projectMembers),
  milestones: many(milestones),
  documents: many(documents),
  activities: many(activities),
  creator: one(users, { fields: [projects.createdBy], references: [users.id] }),
}));

export const milestonesRelations = relations(milestones, ({ many, one }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  milestone: one(milestones, { fields: [tasks.milestoneId], references: [milestones.id] }),
  creator: one(users, { fields: [tasks.createdBy], references: [users.id] }),
  assignee: one(users, { fields: [tasks.assignedTo], references: [users.id] }),
  document: one(documents, { fields: [tasks.documentId], references: [documents.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  project: one(projects, { fields: [documents.projectId], references: [projects.id] }),
  uploader: one(users, { fields: [documents.uploadedBy], references: [users.id] }),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));
