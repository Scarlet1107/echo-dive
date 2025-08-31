import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const wordRouter = createTRPCRouter({
  listByListId: publicProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.word.findMany({
        where: { listId: input.listId },
        orderBy: [{ weight: "desc" }, { createdAt: "asc" }],
        select: { id: true, listId: true, text: true, weight: true, createdAt: true, updatedAt: true },
      });
      return { items };
    }),

  create: publicProcedure
    .input(
      z.object({
        listId: z.string().uuid(),
        text: z.string().min(1).max(200),
        weight: z.number().int().min(1).max(999).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const created = await ctx.db.word.create({
          data: input,
          select: { id: true, listId: true, text: true, weight: true, createdAt: true, updatedAt: true },
        });
        return created;
      } catch (e: any) {
        if (e?.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "同じリストに同一の単語が既に存在します" });
        }
        throw e;
      }
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        text: z.string().min(1).max(200),
        weight: z.number().int().min(1).max(999),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await ctx.db.word.update({
          where: { id: input.id },
          data: { text: input.text, weight: input.weight },
          select: { id: true, listId: true, text: true, weight: true, createdAt: true, updatedAt: true },
        });
        return updated;
      } catch (e: any) {
        if (e?.code === "P2002") {
          // (listId, text) ユニークに引っかかったとき
          throw new TRPCError({ code: "CONFLICT", message: "同じリストに同一の単語が既に存在します" });
        }
        throw e;
      }
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.word.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
