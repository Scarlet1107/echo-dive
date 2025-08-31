// app/_components/DiveBoard.tsx
"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

type Word = { id: string; text: string; weight: number };

type Props = {
    words: Word[];
    density?: number; // 賑やかさ（1.0が標準）
    speedRangeSec?: { min: number; max: number };
    className?: string; // 例: "h-full w-screen"
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const norm = (w: number) => (clamp(Math.trunc(w), 1, 999) - 1) / 998;
const fontFromWeight = (w: number) => 1.5 + norm(w) * 3; // rem
const freqFromWeight = (w: number, density: number) =>
    Math.max(1, Math.round((1 + Math.round(norm(w) * 5)) * density)); // 1..6 * density
const durationFromWeight = (w: number, range: { min: number; max: number }) => {
    const t = norm(w);
    // 重いほどほんの少しゆっくり
    return range.min + (1 - 0.75 * (1 - t)) * (range.max - range.min);
};

type Item = {
    key: string;
    text: string;
    topPx: number;
    fontRem: number;
    durationSec: number;
    delaySec: number; // 負の遅延で途中から流れている風
};

export default function DiveBoard({
    words,
    density = 1,
    speedRangeSec = { min: 14, max: 28 },
    className = "h-full w-screen",
}: Props) {
    const wrapRef = React.useRef<HTMLDivElement>(null);

    const [mounted, setMounted] = React.useState(false); // ← Hydration対策
    const [tracks, setTracks] = React.useState(8);
    const [items, setItems] = React.useState<Item[]>([]);

    // 1) マウントフラグ（SSRと同じHTML=空コンテナ→クライアントで初回描画）
    React.useEffect(() => setMounted(true), []);

    // 2) 高さ→レーン数（ResizeObserver + 変更時のみ更新）
    React.useEffect(() => {
        if (!mounted) return;
        const el = wrapRef.current;
        if (!el) return;

        let raf: number | null = null;
        const compute = () => {
            const h = el.clientHeight || 0;
            const baseRow = 120; // px
            const n = clamp(Math.floor(h / baseRow), 3, 14) || 8;
            setTracks((p) => (p !== n ? n : p));
        };
        compute();

        const ro = new ResizeObserver(() => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                raf = null;
                compute();
            });
        });
        ro.observe(el);

        return () => {
            ro.disconnect();
            if (raf) cancelAnimationFrame(raf);
        };
    }, [mounted]);

    // 3) アイテム生成（マウント後の useEffect 内で乱数を使う）
    React.useEffect(() => {
        if (!mounted) return;

        // weightで複製→シャッフル
        const replicated = words.flatMap((w) =>
            Array.from({ length: freqFromWeight(w.weight, density) }, () => w)
        );
        const shuffled = [...replicated];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            if (shuffled[i] && shuffled[j]) { [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!] };
        }

        const next: Item[] = shuffled.map((w, i) => {
            const font = fontFromWeight(w.weight);
            const dur = durationFromWeight(w.weight, speedRangeSec);
            const track = Math.floor(Math.random() * Math.max(1, tracks));
            const jitter = Math.floor(Math.random() * 10) - 5; // -5..+5 px
            const top = track * 28 + jitter;
            const delay = -Math.random() * dur; // 途中から流れてる風
            return {
                key: `${w.id}-${i}-${Math.random().toString(36).slice(2)}`,
                text: w.text,
                topPx: top,
                fontRem: font,
                durationSec: dur,
                delaySec: delay,
            };
        });

        setItems(next);
    }, [mounted, words, density, tracks, speedRangeSec.min, speedRangeSec.max]);

    return (
        <div
            ref={wrapRef}
            className={`relative select-none pointer-events-none my-12 ${className}`}
            aria-hidden
        >
            {/* SSR時は空のまま。クライアントで mounted になってから描画 */}
            {mounted &&
                items.map((it) => (
                    <motion.span
                        key={it.key}
                        className="absolute whitespace-nowrap text-2xl text-black z-50"
                        style={{
                            top: it.topPx,
                            left: "100vw",               // ← rightをやめて、開始位置を画面右外に
                            fontSize: `${it.fontRem}rem`,
                            lineHeight: 1.1,
                            opacity: 0.92,
                            willChange: "transform",
                        }}
                        initial={{ x: 0, opacity: 0.92 }} // ← ここは0でOK（leftで開始を決める）
                        animate={
                            { x: "-200vw" }          // ← 画面幅2個ぶん左へ抜ける（十分に左外まで）
                        }
                        transition={
                            { duration: it.durationSec, ease: "linear", repeat: Infinity, delay: it.delaySec }
                        }
                    >
                        {it.text}
                    </motion.span>

                ))}
        </div>
    );
}
