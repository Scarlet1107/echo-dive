import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 64);

export const wordListRouter = createTRPCRouter({
  /** ページング付き一覧（最低限） */
  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          cursor: z.string().uuid().optional(), // id cursor
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const items = await ctx.db.wordList.findMany({
        take: limit + 1,
        ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          order: true,
          theme: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      let nextCursor: string | undefined;
      if (items.length > limit) {
        const next = items.pop()!;
        nextCursor = next.id;
      }
      return { items, nextCursor };
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
        theme: z.string().max(64).optional(),
        order: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.slug ? slugify(input.slug) : slugify(input.name);
      try {
        const created = await ctx.db.wordList.create({
          data: {
            name: input.name,
            slug,
            theme: input.theme,
            order: input.order ?? 0,
          },
          select: { id: true, name: true, slug: true, theme: true, order: true, createdAt: true, updatedAt: true },
        });
        return created;
      } catch (e: any) {
        if (e?.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "slug が既に使われています" });
        }
        throw e;
      }
    }),

  rename: publicProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.wordList.update({
        where: { id: input.id },
        data: { name: input.name },
        select: { id: true, name: true, slug: true, theme: true, order: true, createdAt: true, updatedAt: true },
      });
      return updated;
    }),

  setSlug: publicProcedure
    .input(z.object({ id: z.string().uuid(), slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/) }))
    .mutation(async ({ ctx, input }) => {
      const slug = slugify(input.slug);
      try {
        const updated = await ctx.db.wordList.update({
          where: { id: input.id },
          data: { slug },
          select: { id: true, name: true, slug: true, theme: true, order: true, createdAt: true, updatedAt: true },
        });
        return updated;
      } catch (e: any) {
        if (e?.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "slug が既に使われています" });
        }
        throw e;
      }
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Word は onDelete: Cascade なので WordList を消せばOK
      await ctx.db.wordList.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
