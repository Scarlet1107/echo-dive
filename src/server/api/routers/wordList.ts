// src/server/api/routers/wordList.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { th } from "zod/v4/locales";

/** 超ざっくりslugify（必要なら後で強化） */
const toSlug = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");

export const wordListRouter = createTRPCRouter({
  /** 最低限の作成（slug必須なので自動生成） */
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        theme: z.string().optional(),
        order: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = toSlug(input.name);
      const created = await ctx.db.wordList.create({
        data: {
          // id は @default(uuid()) に任せる
          name: input.name,
          slug,
          theme: input.theme ?? null,
          order: input.order ?? 0,
          // createdAt は @default(now())、updatedAt は @updatedAt 推奨（スキーマ側）
        },
        select: { id: true, name: true, slug: true, theme: true, order: true, createdAt: true, updatedAt: true },
      });
      return created;
    }),

  /** 最新のWordListを1件 */
  getLatest: publicProcedure.query(async ({ ctx }) => {
    const latest = await ctx.db.wordList.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, slug: true, theme: true, order: true, createdAt: true, updatedAt: true },
    });
    if (!latest) {
      throw new Error("No WordList found");
    }
    return latest;
  }),

  /** ページング付き一覧（最低限） */
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(), // cursor = id
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const items = await ctx.db.wordList.findMany({
        take: limit + 1,
        ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, slug: true, theme: true, order: true, createdAt: true, updatedAt: true },
      });
      let nextCursor: string | undefined = undefined;
      if (items.length > limit) {
        const next = items.pop()!;
        nextCursor = next.id;
      }
      return { items, nextCursor };
    }),

  /** slugで1件取得（Wordは含めない軽量版） */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.wordList.findUnique({
        where: { slug: input.slug },
        select: { id: true, name: true, slug: true, theme: true, order: true, createdAt: true, updatedAt: true },
      });
    }),

  /** 指定リストのWordを取得（必要最小限） */
  getWordsByListId: publicProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.word.findMany({
        where: { listId: input.listId },
        orderBy: [{ weight: "desc" }, { text: "asc" }],
        select: { id: true, text: true, weight: true, createdAt: true, updatedAt: true },
      });
    }),

  /** 便利版：slugでリスト+Wordsを一気に */
  getListWithWordsBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.wordList.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          name: true,
          slug: true,
          theme: true,
          order: true,
          createdAt: true,
          updatedAt: true,
          Word: {
            orderBy: [{ weight: "desc" }, { text: "asc" }],
            select: { id: true, text: true, weight: true, createdAt: true, updatedAt: true },
          },
        },
      });
    }),
});
