
import { api, HydrateClient } from "@/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_components/ui/card";
import Header from "./_components/Header";

export default async function Home() {
  const wordList = await api.wordList.getLatest();
  const { items } = await api.word.listByListId({ listId: wordList.id, limit: 100 });

  return (
    <HydrateClient>
      <Header />
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md mt-10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              {wordList?.name ?? "Word List"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-center">
              <span className="text-gray-600">Theme:</span> {wordList?.theme}
            </div>
            <div className="mb-4 text-center">
              <span className="text-gray-600">Order:</span> {wordList?.order}
            </div>
            <div>
              <h3 className="font-semibold mb-2">Words</h3>
              <ul className="list-disc list-inside">
                {items?.map((item: any) => (
                  <li key={item.id}>{item.text}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </HydrateClient>
  );
}
