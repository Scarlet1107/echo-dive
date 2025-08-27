import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

// Prismaの一意制約エラーを人間向けに
function mapPrismaError(e: unknown) {
    if (typeof e === "object" && e && "code" in e && (e as any).code === "P2002") {
        return new Error("同じリスト内に同一の text が既に存在します。");
    }
    return e instanceof Error ? e : new Error("unknown error");
}

export const wordRouter = createTRPCRouter({
    /** 1件取得（id） */
    getById: publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
            return ctx.db.word.findUnique({
                where: { id: input.id },
                select: {
                    id: true,
                    listId: true,
                    text: true,
                    weight: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
        }),

    /** 指定リスト配下の一覧（ページング） */
    listByListId: publicProcedure
        .input(
            z.object({
                listId: z.string().uuid(),
                limit: z.number().int().min(1).max(100).default(50),
                cursor: z.string().uuid().optional(), // cursor = id
                q: z.string().trim().max(200).optional(), // 簡易検索（前方一致）
            }),
        )
        .query(async ({ ctx, input }) => {
            const { listId, limit, cursor, q } = input;
            const where = {
                listId,
                ...(q ? { text: { startsWith: q } } : {}),
            };

            const items = await ctx.db.word.findMany({
                where,
                take: limit + 1,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                orderBy: [{ weight: "desc" }, { text: "asc" }, { id: "asc" }],
                select: {
                    id: true,
                    listId: true,
                    text: true,
                    weight: true,
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

    /** 作成 */
    create: publicProcedure
        .input(
            z.object({
                listId: z.string().uuid(),
                text: z.string().min(1),
                weight: z.number().int().optional(), // 省略時はDBのdefault(1)
            }),
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const created = await ctx.db.word.create({
                    data: {
                        listId: input.listId,
                        text: input.text,
                        ...(typeof input.weight === "number" ? { weight: input.weight } : {}),
                        // createdAt は @default(now) / updatedAt は @updatedAt を想定
                    },
                    select: {
                        id: true,
                        listId: true,
                        text: true,
                        weight: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                });
                return created;
            } catch (e) {
                throw mapPrismaError(e);
            }
        }),

    /** 編集（部分更新） */
    update: publicProcedure
        .input(
            z.object({
                id: z.string().uuid(),
                // 任意項目を部分更新
                text: z.string().min(1).optional(),
                weight: z.number().int().optional(),
                // listId を変えるケースも対応（同一制約に注意）
                listId: z.string().uuid().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...patch } = input;
            try {
                const updated = await ctx.db.word.update({
                    where: { id },
                    data: {
                        ...(patch.text !== undefined ? { text: patch.text } : {}),
                        ...(patch.weight !== undefined ? { weight: patch.weight } : {}),
                        ...(patch.listId !== undefined ? { listId: patch.listId } : {}),
                        // updatedAt は @updatedAt が自動更新
                    },
                    select: {
                        id: true,
                        listId: true,
                        text: true,
                        weight: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                });
                return updated;
            } catch (e) {
                throw mapPrismaError(e);
            }
        }),

    /** 削除 */
    delete: publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.word.delete({ where: { id: input.id } });
            return { ok: true };
        }),
});
