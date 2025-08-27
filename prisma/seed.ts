import { db } from "../src/server/db";

async function main() {
    // まず既存をクリア（外部キー制約の順番に注意！）
    await db.word.deleteMany();
    await db.wordList.deleteMany();

    const list1 = await db.wordList.create({
        data: {
            name: "基本ワードリスト",
            slug: "basic",
            order: 1,
            theme: "blue",
            updatedAt: new Date(),
            Word: {
                create: [
                    { text: "海", weight: 1, updatedAt: new Date() },
                    { text: "山", weight: 2, updatedAt: new Date() },
                ],
            },
        },
    });

    const list2 = await db.wordList.create({
        data: {
            name: "感情ワードリスト",
            slug: "feelings",
            order: 2,
            theme: "pink",
            updatedAt: new Date(),
            Word: {
                create: [
                    { text: "楽しい", weight: 1, updatedAt: new Date() },
                    { text: "悲しい", weight: 1, updatedAt: new Date() },
                    { text: "怒り", weight: 3, updatedAt: new Date() },
                ],
            },
        },
    });

    console.log("Seed 完了:", { list1, list2 });
}

main()
    .then(async () => await db.$disconnect())
    .catch(async (e) => {
        console.error(e);
        await db.$disconnect();
        process.exit(1);
    });
