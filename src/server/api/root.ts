import { wordListRouter } from "@/server/api/routers/wordList";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { wordRouter } from "./routers/word";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  wordList: wordListRouter,
  word: wordRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
