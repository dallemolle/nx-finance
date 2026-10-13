import { OTHERS_CATEGORY_COLOR } from "./dashboard-utils";

// Cores de categoria sorteadas (nova categoria e botão "Sugerir cor"). Sorteia
// de uma paleta de tons médios e escuros, legíveis nos dois temas e bem
// distintos entre si, evitando as cores já usadas e as parecidas com elas —
// senão duas categorias ficariam indistinguíveis no gráfico.
export const CATEGORY_PALETTE = [
    "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#14b8a6", "#3b82f6",
    "#8b5cf6", "#d946ef", "#ec4899", "#c2410c", "#a16207", "#15803d",
    "#0f766e", "#1d4ed8", "#7e22ce", "#a21caf", "#be123c",
];

// Distância OKLab abaixo disso = "parecidas" (difícil de distinguir lado a lado).
const SIMILAR_DISTANCE = 0.08;

const HEX = /^#([0-9a-f]{6})$/i;

function toOklab(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}

function distance(a: string, b: string): number {
    const [l1, a1, b1] = toOklab(a);
    const [l2, a2, b2] = toOklab(b);
    return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export function areColorsSimilar(a: string, b: string): boolean {
    return distance(a.toLowerCase(), b.toLowerCase()) < SIMILAR_DISTANCE;
}

function hslToHex(h: number, s: number, l: number): string {
    const k = (n: number) => (n + h / 30) % 12;
    const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return `#${[f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
}

// `random` é injetável só pros testes.
export function suggestCategoryColor(existing: (string | null | undefined)[], random: () => number = Math.random): string {
    const taken = [...existing.filter((c): c is string => !!c && HEX.test(c)).map(c => c.toLowerCase()), OTHERS_CATEGORY_COLOR];
    const isFree = (color: string) => !taken.some(t => areColorsSimilar(t, color));

    const free = CATEGORY_PALETTE.filter(isFree);
    if (free.length > 0) return free[Math.floor(random() * free.length)];

    // Paleta toda em uso: entre várias cores aleatórias (tons médios), a mais
    // distante de todas as existentes.
    let best = "";
    let bestDistance = -1;
    for (let i = 0; i < 64; i++) {
        const candidate = hslToHex(random() * 360, 0.6 + random() * 0.25, 0.4 + random() * 0.15);
        const nearest = Math.min(...taken.map(t => distance(t, candidate)));
        if (nearest > bestDistance) { best = candidate; bestDistance = nearest; }
    }
    return best;
}
