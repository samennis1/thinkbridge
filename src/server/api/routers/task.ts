import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { tasks, projectMembers } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { get } from "http";

export const taskRouter = createTRPCRouter({
  editTask: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        assignedTo: z.string().optional(),
        dueDate: z.string().optional(),
        documentIds: z.number(),
        priority: z.enum(["1", "2", "3", "4", "5"]),
        status: z.enum(["To Do", "In Progress", "Completed"]),
        policyContent: z.string().optional(),
        recommendedContent: z.string().optional(),
        policyHeader: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: (fields) => eq(fields.id, input.id),
        columns: { projectId: true },
      });

      if (!task) {
        throw new Error("Task not found");
      }

      const member = await ctx.db.query.projectMembers.findFirst({
        where: (fields) =>
          and(
            eq(fields.projectId, task.projectId),
            eq(fields.userId, ctx.session.user.id),
          ),
        columns: { role: true },
      });

      if (!member || !["Manager", "Researcher"].includes(member.role)) {
        throw new Error("You do not have permission to edit this task");
      }

      await ctx.db
        .update(tasks)
        .set({
          title: input.title,
          description: input.description,
          status: input.status,
          assignedTo: input.assignedTo,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          documentId: input.documentIds,
          priority: input.priority,
          policyContent: input.policyContent,
          recommendedContent: input.recommendedContent,
          policyHeader: input.policyHeader,
        })
        .where(eq(tasks.id, input.id));
    }),

  deleteTask: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.query.tasks.findFirst({
        where: (fields) => eq(fields.id, input.id),
        columns: { projectId: true },
      });

      if (!task) {
        throw new Error("Task not found");
      }

      const member = await ctx.db.query.projectMembers.findFirst({
        where: (fields) =>
          and(
            eq(fields.projectId, task.projectId),
            eq(fields.userId, ctx.session.user.id),
          ),
        columns: { role: true },
      });

      if (!member || !["Manager", "Researcher"].includes(member.role)) {
        throw new Error("You do not have permission to delete this task");
      }

      await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
    }),

  getProjectDetails: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: (fields) => eq(fields.id, input.projectId),
        columns: { name: true },
      });

      if (!project) {
        throw new Error("Project not found");
      }

      const milestonesWithTasks = await ctx.db.query.milestones.findMany({
        where: (fields) => eq(fields.projectId, input.projectId),
        columns: { id: true, title: true, description: true },
        with: {
          tasks: {
            orderBy: tasks.order,
            columns: {
              id: true,
              title: true,
              description: true,
              status: true,
              order: true,
            },
          },
        },
      });

      return {
        projectTitle: project.name,
        milestones: milestonesWithTasks.map((milestone) => ({
          title: milestone.title,
          description: milestone.description,
          tasks: milestone.tasks,
        })),
      };
    }),

  getTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.tasks.findFirst({
        where: (fields) => eq(fields.id, input.taskId),
      });
    }),
});
