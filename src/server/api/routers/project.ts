import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { projects, projectMembers, documents, milestones, tasks, activities } from "~/server/db/schema";
import { eq, and, desc, or, inArray, sql, count, sum } from "drizzle-orm";
import { logActivity } from "../utils/activity-logger";
import { type Activity } from "~/types/activity";

export const projectRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.insert(projects).values({
          name: input.name,
          description: input.description ?? "",
          createdBy: ctx.session.user.id,
        });
        
        const insertResult = result[0];
        const projectId = insertResult ? Number(insertResult.insertId) : null;
        
        if (projectId) {
          await logActivity({
            db: ctx.db,
            userId: ctx.session.user.id,
            projectId: projectId,
            actionType: "create_project",
            entityId: projectId,
            entityType: "project",
            details: { name: input.name }
          });
          
          return { id: projectId };
        }
        
        return { id: null };
      } catch (error) {
        console.error("Failed to create project:", error);
        throw new Error("Failed to create project");
      }
    }),

  getProjects: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(projects)
      .where(eq(projects.createdBy, ctx.session.user.id));
  }),

  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        userId: z.string(),
        role: z.enum(["Manager", "Researcher", "Viewer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.insert(projectMembers).values({
          projectId: input.projectId,
          userId: input.userId,
          role: input.role,
        });
        
        const insertId = result[0] ? Number(result[0].insertId) : null;
        
        if (insertId) {
          const newMember = await ctx.db
            .select()
            .from(projectMembers)
            .where(
              and(
                eq(projectMembers.projectId, input.projectId),
                eq(projectMembers.userId, input.userId)
              )
            )
            .limit(1);
            
          const newMemberId = newMember[0]?.id;
          
          if (newMemberId) {
            await logActivity({
              db: ctx.db,
              userId: ctx.session.user.id,
              projectId: input.projectId,
              actionType: "add_member",
              entityId: newMemberId,
              entityType: "member",
              details: { addedUserId: input.userId, role: input.role },
            });
          }
        }
      } catch (error) {
        console.error("Failed to add member:", error);
        throw new Error("Failed to add member");
      }
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, input.userId)
          )
        );

      await logActivity({
        db: ctx.db,
        userId: ctx.session.user.id,
        projectId: input.projectId,
        actionType: "remove_member",
        entityId: 0,
        entityType: "member",
        details: { removedUserId: input.userId },
      });
    }),

  getProjectDetails: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: (fields) => eq(fields.id, input.projectId),
      });

      return project ?? null;
    }),

  assignDocument: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        fileUrl: z.string(),
        projectId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.insert(documents).values({
          title: input.title,
          fileUrl: input.fileUrl,
          projectId: input.projectId,
          uploadedBy: ctx.session.user.id,
        });
        
        const insertId = result[0] ? Number(result[0].insertId) : null;
        
        if (insertId) {
          const newDoc = await ctx.db
            .select()
            .from(documents)
            .where(eq(documents.id, insertId))
            .limit(1);
            
          const docId = newDoc[0]?.id;
          
          if (docId) {
            await logActivity({
              db: ctx.db,
              userId: ctx.session.user.id,
              projectId: input.projectId,
              actionType: "add_document",
              entityId: docId,
              entityType: "document",
              details: { title: input.title },
            });
          }
        }
      } catch (error) {
        console.error("Failed to assign document:", error);
        throw new Error("Failed to assign document");
      }
    }),

  getDocuments: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(documents)
        .where(eq(documents.projectId, input.projectId));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: (projects, { eq }) =>
          eq(projects.id, parseInt(input.id)),
      });

      if (!project) {
        throw new Error("Project not found");
      }

      return project;
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const memberProjectRecords = await ctx.db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, ctx.session.user.id));

    const projectIds = memberProjectRecords.map(p => p.projectId);

    const allProjects = await ctx.db
      .select()
      .from(projects)
      .where(
        or(
          eq(projects.createdBy, ctx.session.user.id),
          inArray(projects.id, projectIds.length > 0 ? projectIds : [-1])
        )
      );

    const enhancedProjects = await Promise.all(
      allProjects.map(async (project) => {
        const projectMilestones = await ctx.db
          .select()
          .from(milestones)
          .where(eq(milestones.projectId, project.id));

        const projectTasks = await ctx.db
          .select()
          .from(tasks)
          .where(eq(tasks.projectId, project.id));

        const completedTasksCount = projectTasks.filter(
          task => task.status === "Completed"
        ).length;

        const projectMemberRecords = await ctx.db
          .select()
          .from(projectMembers)
          .where(eq(projectMembers.projectId, project.id));

        const totalTasks = projectTasks.length;
        const completionPercentage = totalTasks > 0
          ? Math.round((completedTasksCount / totalTasks) * 100)
          : 0;

        return {
          ...project,
          milestones: projectMilestones,
          tasks: projectTasks,
          members: projectMemberRecords,
          completedTasksCount,
          totalTasks,
          completionPercentage
        };
      })
    );

    return enhancedProjects;
  }),

  getRecentActivity: protectedProcedure.query(async ({ ctx }) => {
    const memberProjectRecords = await ctx.db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, ctx.session.user.id));

    const projectIds = memberProjectRecords.map(p => p.projectId);

    const allProjectIds = await ctx.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        or(
          eq(projects.createdBy, ctx.session.user.id),
          inArray(projects.id, projectIds.length > 0 ? projectIds : [-1])
        )
      );

    const accessibleProjectIds = allProjectIds.map(p => p.id);

    if (accessibleProjectIds.length === 0) {
      return [];
    }

    const recentActivities = await ctx.db
      .select({
        id: activities.id,
        userId: activities.userId,
        projectId: activities.projectId,
        actionType: activities.actionType,
        entityId: activities.entityId,
        entityType: activities.entityType,
        details: activities.details,
        createdAt: activities.createdAt,
        userName: sql<string>`(SELECT name FROM thinkhub_user WHERE id = ${activities.userId})`,
        userImage: sql<string>`(SELECT image FROM thinkhub_user WHERE id = ${activities.userId})`,
        projectName: sql<string>`(SELECT name FROM thinkhub_project WHERE id = ${activities.projectId})`
      })
      .from(activities)
      .where(inArray(activities.projectId, accessibleProjectIds))
      .orderBy(desc(activities.createdAt))
      .limit(20);

    return recentActivities.map(activity => {
      const detailsObj = activity.details ? JSON.parse(activity.details) as Record<string, unknown> : {};
      const timeAgo = formatTimeAgo(activity.createdAt);
      const actionText = formatActionText(activity.actionType);

      return {
        id: activity.id,
        user: activity.userName || "Unknown User",
        userImage: activity.userImage,
        action: actionText,
        project: activity.projectName || "Unknown Project",
        time: timeAgo,
        details: detailsObj,
        entityType: activity.entityType,
        entityId: activity.entityId,
      };
    });
  }),

  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const memberProjectRecords = await ctx.db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, ctx.session.user.id));

    const projectIds = memberProjectRecords.map(p => p.projectId);

    const allProjectIds = await ctx.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        or(
          eq(projects.createdBy, ctx.session.user.id),
          inArray(projects.id, projectIds.length > 0 ? projectIds : [-1])
        )
      );

    const accessibleProjectIds = allProjectIds.map(p => p.id);

    if (accessibleProjectIds.length === 0) {
      return {
        totalProjects: 0,
        activeMilestones: 0,
        teamMembers: 0,
        completedTasks: 0,
        totalTasks: 0,
        upcomingDeadlines: []
      };
    }

    const totalProjects = accessibleProjectIds.length;

    const activeMilestonesResult = await ctx.db
      .select({ count: count() })
      .from(milestones)
      .where(
        and(
          inArray(milestones.projectId, accessibleProjectIds),
          or(
            eq(milestones.status, "Planned"),
            eq(milestones.status, "In Progress")
          )
        )
      );
    const activeMilestones = activeMilestonesResult[0]?.count ?? 0;

    const teamMembersResult = await ctx.db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(inArray(projectMembers.projectId, accessibleProjectIds))
      .groupBy(projectMembers.userId);
    const teamMembers = teamMembersResult.length;

    const completedTasksResult = await ctx.db
      .select({ count: count() })
      .from(tasks)
      .where(
        and(
          inArray(tasks.projectId, accessibleProjectIds),
          eq(tasks.status, "Completed")
        )
      );
    const completedTasks = completedTasksResult[0]?.count ?? 0;

    const totalTasksResult = await ctx.db
      .select({ count: count() })
      .from(tasks)
      .where(inArray(tasks.projectId, accessibleProjectIds));
    const totalTasks = totalTasksResult[0]?.count ?? 0;

    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    const upcomingDeadlines = await ctx.db
      .select({
        id: milestones.id,
        title: milestones.title,
        dueDate: milestones.dueDate,
        status: milestones.status,
        projectId: milestones.projectId,
        projectName: sql<string>`(SELECT name FROM thinkhub_project WHERE id = ${milestones.projectId})`
      })
      .from(milestones)
      .where(
        and(
          inArray(milestones.projectId, accessibleProjectIds),
          sql`${milestones.dueDate} > CURRENT_TIMESTAMP`,
          sql`${milestones.dueDate} < ${twoWeeksFromNow}`,
          or(
            eq(milestones.status, "Planned"),
            eq(milestones.status, "In Progress")
          )
        )
      )
      .orderBy(milestones.dueDate)
      .limit(5);

    const formattedDeadlines = upcomingDeadlines.map(deadline => {
      const dueDate = new Date(deadline.dueDate);
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const status = daysUntilDue <= 3 ? "At Risk" : "On Track";

      return {
        id: deadline.id,
        name: deadline.title,
        project: deadline.projectName || "Unknown Project",
        date: deadline.dueDate.toISOString().split("T")[0],
        status,
      };
    });

    return {
      totalProjects,
      activeMilestones,
      teamMembers,
      completedTasks,
      totalTasks,
      upcomingDeadlines: formattedDeadlines,
    };
  }),
});

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} second${diffInSeconds !== 1 ? "s" : ""} ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays !== 1 ? "s" : ""} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths !== 1 ? "s" : ""} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears !== 1 ? "s" : ""} ago`;
}

function formatActionText(actionType: Activity["actionType"]): string {
  switch (actionType) {
    case "create_project":
      return "created a new project";
    case "update_project":
      return "updated project details";
    case "create_milestone":
      return "created a new milestone";
    case "complete_milestone":
      return "completed a milestone";
    case "create_task":
      return "created a new task";
    case "update_task":
      return "updated a task";
    case "complete_task":
      return "completed a task";
    case "add_document":
      return "added a document";
    case "add_member":
      return "added a team member";
    case "remove_member":
      return "removed a team member";
    case "comment":
      return "added a comment";
    default:
      return "performed an action";
  }
}
