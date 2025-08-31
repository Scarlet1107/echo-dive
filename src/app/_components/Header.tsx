"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { List, BookText, Languages, ChevronDown, Plus, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/app/_components/ui/button";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger,
    DropdownMenuSubContent, DropdownMenuGroup,
} from "@/app/_components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/app/_components/ui/dialog";
import { Input } from "@/app/_components/ui/input";
import { Separator } from "@/app/_components/ui/separator";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/app/_components/ui/hover-card";
import { ScrollArea } from "./ui/scroll-area";

type WordList = {
    id: string;
    name: string;
    slug: string;
    theme: string | null;
    order: number;
    createdAt: Date;
    updatedAt: Date;
};
type Word = { id: string; text: string; weight: number; listId: string };

function useInput(initial = "") {
    const [v, setV] = React.useState(initial);
    return { value: v, set: setV, bind: { value: v, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV(e.target.value) } };
}

export default function Header({
    initialLists,
    initialActiveListId,
}: {
    initialLists: WordList[];
    initialActiveListId: string | null;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const sp = useSearchParams();

    const utils = api.useUtils();
    const { data: listData } = api.wordList.list.useQuery(
        { limit: 50 },
        { initialData: { items: initialLists, nextCursor: undefined } },
    );
    const lists = listData?.items ?? [];

    const listFromUrl = sp.get("list");
    const activeListId = listFromUrl ?? initialActiveListId ?? undefined;
    const activeList = lists.find((l) => l.id === activeListId) ?? null;

    const { data: wordsData } = api.word.listByListId.useQuery(
        { listId: activeListId ?? "" },
        { enabled: !!activeListId },
    );
    const words = (wordsData?.items ?? []) as Word[];

    const replaceListParam = (id: string) => {
        const next = new URLSearchParams(sp.toString());
        next.set("list", id);
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    };

    /** ===== Mutations ===== */
    const createList = api.wordList.create.useMutation({
        onMutate: async (vars) => {
            await utils.wordList.list.cancel();
            const prev = utils.wordList.list.getData({ limit: 50 });
            const tempId = `temp-${crypto.randomUUID()}`;
            utils.wordList.list.setData({ limit: 50 }, (old) => ({
                items: [...(old?.items ?? []), {
                    id: tempId,
                    name: vars.name,
                    slug: "",
                    theme: null,
                    order: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }],
                nextCursor: old?.nextCursor,
            }));
            return { prev, tempId };
        },
        onError: (_e, _v, ctx) => {
            utils.wordList.list.setData({ limit: 50 }, ctx?.prev);
            toast.error("リストの作成に失敗しました");
        },
        onSuccess: (created, _v, ctx) => {
            utils.wordList.list.setData({ limit: 50 }, (old) => ({
                items: (old?.items ?? []).map((l) => (l.id === ctx?.tempId ? created : l)),
                nextCursor: old?.nextCursor,
            }));
            replaceListParam(created.id);
            toast.success("リストを作成しました");
        },
        onSettled: () => utils.wordList.list.invalidate({ limit: 50 }),
    });

    const renameList = api.wordList.rename.useMutation({
        onMutate: async (vars) => {
            await utils.wordList.list.cancel({ limit: 50 });
            const prev = utils.wordList.list.getData({ limit: 50 });
            utils.wordList.list.setData({ limit: 50 }, (old) => ({
                items: (old?.items ?? []).map((l) => (l.id === vars.id ? { ...l, name: vars.name } : l)),
                nextCursor: old?.nextCursor,
            }));
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            utils.wordList.list.setData({ limit: 50 }, ctx?.prev);
            toast.error("リスト名の変更に失敗しました");
        },
        onSuccess: () => toast.success("リスト名を変更しました"),
        onSettled: () => utils.wordList.list.invalidate({ limit: 50 }),
    });

    const deleteList = api.wordList.delete.useMutation({
        onMutate: async (vars) => {
            await utils.wordList.list.cancel({ limit: 50 });
            const prev = utils.wordList.list.getData({ limit: 50 });
            utils.wordList.list.setData({ limit: 50 }, (old) => ({
                items: (old?.items ?? []).filter((l) => l.id !== vars.id),
                nextCursor: old?.nextCursor,
            }));
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            utils.wordList.list.setData({ limit: 50 }, ctx?.prev);
            toast.error("リストの削除に失敗しました");
        },
        onSuccess: () => {
            const nextId = utils.wordList.list.getData({ limit: 50 })?.items?.[0]?.id;
            if (nextId) replaceListParam(nextId);
            toast.success("リストを削除しました");
        },
        onSettled: () => utils.wordList.list.invalidate({ limit: 50 }),
    });

    const createWord = api.word.create.useMutation({
        onMutate: async (vars) => {
            if (!activeListId) return;
            await utils.word.listByListId.cancel({ listId: activeListId });
            const prev = utils.word.listByListId.getData({ listId: activeListId });
            const tempId = `temp-${crypto.randomUUID()}`;
            utils.word.listByListId.setData({ listId: activeListId }, (old) => ({
                items: [...(old?.items ?? []), {
                    id: tempId,
                    listId: vars.listId,
                    text: vars.text,
                    weight: vars.weight ?? 100,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }],
            }));
            return { prev, tempId };
        },
        onError: (_e, _v, ctx) => {
            if (!activeListId) return;
            utils.word.listByListId.setData({ listId: activeListId }, ctx?.prev);
            toast.error("単語の追加に失敗しました");
        },
        onSuccess: () => {
            if (!activeListId) return;
            utils.word.listByListId.invalidate({ listId: activeListId });
            toast.success("単語を追加しました");
        },
    });

    const updateWord = api.word.update.useMutation({
        onMutate: async (vars) => {
            if (!activeListId) return;
            await utils.word.listByListId.cancel({ listId: activeListId });
            const prev = utils.word.listByListId.getData({ listId: activeListId });
            utils.word.listByListId.setData({ listId: activeListId }, (old) => ({
                items: (old?.items ?? []).map((w) =>
                    w.id === vars.id ? { ...w, text: vars.text, weight: vars.weight } : w,
                ),
            }));
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (!activeListId) return;
            utils.word.listByListId.setData({ listId: activeListId }, ctx?.prev);
            toast.error("単語の更新に失敗しました");
        },
        onSuccess: () => {
            if (!activeListId) return;
            utils.word.listByListId.invalidate({ listId: activeListId });
            toast.success("単語を更新しました");
        },
    });

    const deleteWord = api.word.delete.useMutation({
        onMutate: async (vars) => {
            if (!activeListId) return;
            await utils.word.listByListId.cancel({ listId: activeListId });
            const prev = utils.word.listByListId.getData({ listId: activeListId });
            utils.word.listByListId.setData({ listId: activeListId }, (old) => ({
                items: (old?.items ?? []).filter((w) => w.id !== vars.id),
            }));
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (!activeListId) return;
            utils.word.listByListId.setData({ listId: activeListId }, ctx?.prev);
            toast.error("単語の削除に失敗しました");
        },
        onSuccess: () => {
            if (!activeListId) return;
            utils.word.listByListId.invalidate({ listId: activeListId });
            toast.success("単語を削除しました");
        },
    });

    // ===== Dialog states =====
    const [openCreateList, setOpenCreateList] = React.useState(false);
    const [openRenameList, setOpenRenameList] = React.useState(false);
    const [openDeleteList, setOpenDeleteList] = React.useState(false);
    const [openCreateWord, setOpenCreateWord] = React.useState(false);
    const [openEditWord, setOpenEditWord] = React.useState<Word | null>(null);
    const [openDeleteWordDlg, setOpenDeleteWordDlg] = React.useState<Word | null>(null);

    const nameNewList = useInput("");
    const nameRenameList = useInput(activeList?.name ?? "");
    React.useEffect(() => nameRenameList.set(activeList?.name ?? ""), [openRenameList, activeList?.name]);

    const wordText = useInput("");
    const wordWeight = useInput("100");
    const wordTextEdit = useInput(openEditWord?.text ?? "");
    const wordWeightEdit = useInput(openEditWord?.weight?.toString() ?? "100");
    React.useEffect(() => {
        wordTextEdit.set(openEditWord?.text ?? "");
        wordWeightEdit.set(openEditWord?.weight?.toString() ?? "100");
    }, [openEditWord]);

    // ===== Handlers =====
    const handleCreateList = () => {
        const name = nameNewList.value.trim();
        if (!name) return toast.error("リスト名を入力してください");
        createList.mutate({ name });
        nameNewList.set("");
        setOpenCreateList(false);
    };
    const handleRenameList = () => {
        if (!activeList) return;
        const name = nameRenameList.value.trim();
        if (!name) return toast.error("新しいリスト名を入力してください");
        renameList.mutate({ id: activeList.id, name });
        setOpenRenameList(false);
    };
    const handleDeleteList = () => {
        if (!activeList) return;
        deleteList.mutate({ id: activeList.id });
        setOpenDeleteList(false);
    };

    const parseWeight = (s: string) => {
        const n = Number(s);
        return Number.isFinite(n) ? Math.max(1, Math.min(999, Math.trunc(n))) : NaN;
    };

    const handleCreateWord = () => {
        if (!activeListId) return toast.error("アクティブなリストがありません");
        const t = wordText.value.trim();
        const w = parseWeight(wordWeight.value);
        if (!t) return toast.error("単語を入力してください");
        if (Number.isNaN(w)) return toast.error("重要度は1〜999の整数で入力してください");
        createWord.mutate({ listId: activeListId, text: t, weight: w });
        wordText.set("");
        wordWeight.set("100");
    };
    const handleEditWord = () => {
        if (!openEditWord) return;
        const t = wordTextEdit.value.trim();
        const w = parseWeight(wordWeightEdit.value);
        if (!t) return toast.error("単語を入力してください");
        if (Number.isNaN(w)) return toast.error("重要度は1〜999の整数で入力してください");
        updateWord.mutate({ id: openEditWord.id, text: t, weight: w });
        setOpenEditWord(null);
    };
    const handleDeleteWord = () => {
        if (!openDeleteWordDlg) return;
        deleteWord.mutate({ id: openDeleteWordDlg.id });
        setOpenDeleteWordDlg(null);
    };

    // ===== Key helpers (Enter / Ctrl+Enter) =====
    const submitOnEnter =
        (handler: () => void) =>
            (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handler();
                }
            };

    return (
        <header className="w-full flex items-center justify-between p-4 px-6 bg-card border-b">
            {/* 左：タイトル + 概要 */}
            <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Echo Dive</h2>

                <HoverCard openDelay={100}>
                    <HoverCardTrigger asChild>
                        <Button variant="secondary" className="h-9">
                            <List className="w-4 h-4 mr-2" />
                            {activeList?.name ?? "リスト未選択"}
                        </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-muted"><BookText className="w-5 h-5" /></div>
                            <div className="space-y-1">
                                <p className="font-medium">{activeList?.name ?? "—"}</p>
                                <p className="text-sm text-muted-foreground">
                                    ヘッダーのメニューから<b>リストの切替/作成/編集/削除</b>と
                                    <b>単語の追加/編集/削除</b>ができます。
                                </p>
                                <div className="text-xs text-muted-foreground">単語数: {words.length} 件</div>
                            </div>
                        </div>
                    </HoverCardContent>
                </HoverCard>
            </div>

            {/* 右：リスト操作 と 単語操作 */}
            <div className="flex items-center gap-2">
                {/* リスト管理 */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9">
                            <List className="w-4 h-4 mr-2" />
                            リスト
                            <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>アクティブ: {activeList?.name ?? "—"}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <BookText className="w-4 h-4 mr-2" />
                                    リストを切り替える
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-56">
                                    {lists.map((l) => (
                                        <DropdownMenuItem
                                            key={l.id}
                                            onSelect={(e) => { e.preventDefault(); replaceListParam(l.id); }}
                                            className={l.id === activeListId ? "font-semibold" : ""}
                                        >
                                            {l.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpenCreateList(true); }}>
                                <Plus className="w-4 h-4 mr-2" /> リストを作成
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={(e) => { e.preventDefault(); if (activeList) setOpenRenameList(true); }}
                                disabled={!activeList}
                            >
                                <Pencil className="w-4 h-4 mr-2" /> リストを編集
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={(e) => { e.preventDefault(); if (activeList) setOpenDeleteList(true); }}
                                disabled={!activeList}
                                className="text-red-600 focus:text-red-600"
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> リストを削除
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* 単語管理 */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9" disabled={!activeListId}>
                            <Languages className="w-4 h-4 mr-2" />
                            単語
                            <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                        <DropdownMenuLabel>{activeList?.name ?? "—"} の単語</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpenCreateWord(true); }} disabled={!activeListId}>
                            <Plus className="w-4 h-4 mr-2" /> 単語を追加
                        </DropdownMenuItem>
                        <ScrollArea className="h-[40vh]">
                            <DropdownMenuSeparator />
                            {words.map((w) => (
                                <div key={w.id} className="px-2 py-1.5 text-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="truncate">
                                            <span className="font-medium">{w.text}</span>
                                            <span className="text-muted-foreground"> — 重要度:{w.weight}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="icon" variant="ghost" onClick={() => setOpenEditWord(w)} title="編集">
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => setOpenDeleteWordDlg(w)} title="削除" className="text-red-600">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* ==== Dialogs ==== */}
            {/* リスト作成 */}
            <Dialog open={openCreateList} onOpenChange={setOpenCreateList}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>リストを作成</DialogTitle>
                        <DialogDescription>Enter / Ctrl+Enter で作成できます。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label className="text-sm">リスト名</label>
                        <Input
                            placeholder='例: 世界観メモ / 場所の名前'
                            {...nameNewList.bind}
                            onKeyDown={submitOnEnter(handleCreateList)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenCreateList(false)}>
                            キャンセル
                        </Button>
                        <Button onClick={handleCreateList} disabled={createList.isPending}>
                            作成
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* リスト改名 */}
            <Dialog open={openRenameList} onOpenChange={setOpenRenameList}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>リストを編集</DialogTitle>
                        <DialogDescription>Enter / Ctrl+Enter で保存できます。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label className="text-sm">新しいリスト名</label>
                        <Input
                            placeholder="新しいリスト名"
                            {...nameRenameList.bind}
                            onKeyDown={submitOnEnter(handleRenameList)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenRenameList(false)}>
                            キャンセル
                        </Button>
                        <Button onClick={handleRenameList} disabled={renameList.isPending}>
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* リスト削除 */}
            <Dialog open={openDeleteList} onOpenChange={setOpenDeleteList}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>リストを削除</DialogTitle>
                        <DialogDescription>この操作は取り消せません。このリストの単語も削除されます。</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenDeleteList(false)}>
                            キャンセル
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteList} disabled={deleteList.isPending}>
                            削除する
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 単語追加 */}
            <Dialog open={openCreateWord} onOpenChange={setOpenCreateWord}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>単語を追加</DialogTitle>
                        <DialogDescription>Enter / Ctrl+Enter で追加できます。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm">単語</label>
                            <Input
                                placeholder='例: 祠 / 遺構 / 群青'
                                {...wordText.bind}
                                onKeyDown={submitOnEnter(handleCreateWord)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm">重要度（1〜999）</label>
                            <Input
                                type="number"
                                min={1}
                                max={999}
                                step={1}
                                {...wordWeight.bind}
                                onKeyDown={submitOnEnter(handleCreateWord)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenCreateWord(false)}>キャンセル</Button>
                        <Button onClick={handleCreateWord}>追加</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 単語編集 */}
            <Dialog open={!!openEditWord} onOpenChange={(o) => !o && setOpenEditWord(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>単語を編集</DialogTitle>
                        <DialogDescription>Enter / Ctrl+Enter で保存できます。</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm">単語</label>
                            <Input
                                placeholder="単語"
                                {...wordTextEdit.bind}
                                onKeyDown={submitOnEnter(handleEditWord)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm">重要度（1〜999）</label>
                            <Input
                                type="number"
                                min={1}
                                max={999}
                                step={1}
                                {...wordWeightEdit.bind}
                                onKeyDown={submitOnEnter(handleEditWord)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenEditWord(null)}>キャンセル</Button>
                        <Button onClick={handleEditWord}>保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 単語削除 */}
            <Dialog open={!!openDeleteWordDlg} onOpenChange={(o) => !o && setOpenDeleteWordDlg(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>単語を削除</DialogTitle>
                        <DialogDescription>この操作は取り消せません。</DialogDescription>
                    </DialogHeader>
                    <div className="text-sm">
                        {openDeleteWordDlg ? (<>削除する単語：<b>{openDeleteWordDlg.text}</b>（重要度:{openDeleteWordDlg.weight}）</>) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenDeleteWordDlg(null)}>キャンセル</Button>
                        <Button variant="destructive" onClick={handleDeleteWord}>削除する</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </header>
    );
}
