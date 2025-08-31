// app/page.tsx
import { api, HydrateClient } from "@/trpc/server";
import Header from "./_components/Header";
import DiveBoard from "./_components/DiveBoard";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const sp = await searchParams;
  const listFromUrl = Array.isArray(sp.list) ? sp.list[0] : sp.list;

  const { items } = await api.wordList.list({ limit: 50 });
  const activeId =
    listFromUrl && items.some((l) => l.id === listFromUrl)
      ? listFromUrl
      : items[0]?.id ?? null;

  const words =
    activeId ? (await api.word.listByListId({ listId: activeId })).items : [];
  console.log("words", words)

  return (
    <HydrateClient>
      {/* ここで全体を縦フレックスにして残りをmainへ */}
      <div className="min-h-screen flex flex-col">
        <Header initialLists={items} initialActiveListId={activeId} />
        <main className="flex-1 w-screen p-0 m-0 overflow-x-scroll scrollbar-none">
          <DiveBoard words={words as any} />
        </main>
      </div>
    </HydrateClient>
  );
}
