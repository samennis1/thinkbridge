import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { projectMembers, users } from "~/server/db/schema";
import { eq, and, like } from "drizzle-orm";
import { logActivity } from "../utils/activity-logger";

export const memberRouter = createTRPCRouter({
  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        email: z.string().email(),
        role: z.enum(["Manager", "Researcher", "Viewer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await ctx.db.query.users.findFirst({
          where: eq(users.email, input.email),
        });

        if (!user) {
          throw new Error("User not found");
        }

        const existingMember = await ctx.db.query.projectMembers.findFirst({
          where: and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, user.id),
          ),
        });

        if (existingMember) {
          throw new Error("User is already a member of this project");
        }

        const result = await ctx.db.insert(projectMembers).values({
          projectId: input.projectId,
          userId: user.id,
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
                eq(projectMembers.userId, user.id)
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
              details: { 
                addedUserId: user.id, 
                addedUserEmail: user.email,
                addedUserName: user.name,
                role: input.role 
              }
            });
          }
        }

        return { success: true };
      } catch (error) {
        console.error("Failed to add member:", error);
        throw error;
      }
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, input.userId),
          ),
        );

      return { success: true };
    }),

  getProjectMembers: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const members = await ctx.db
        .select({
          id: projectMembers.id,
          userId: projectMembers.userId,
          role: projectMembers.role,
          joinedAt: projectMembers.joinedAt,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, input.projectId));

      return members;
    }),

  searchUsersByEmail: protectedProcedure
    .input(
      z.object({
        email: z.string().min(3),
        projectId: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const matchingUsers = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(users)
        .where(like(users.email, `%${input.email}%`))
        .limit(5);

      const existingMembers = await ctx.db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, input.projectId));

      const existingMemberIds = new Set(existingMembers.map(m => m.userId));

      return matchingUsers.filter(user => !existingMemberIds.has(user.id));
    }),
}); 