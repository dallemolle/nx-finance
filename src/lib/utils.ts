import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const TITLE_KEYS = ["title", "descricao", "descrição", "description", "nome", "name", "item", "historico", "lançamento", "lancamento", "produto", "servico", "serviço"];
const AMOUNT_KEYS = ["amount", "valor", "value", "valr", "val", "preco", "preço", "total", "vlr", "valr", "montante"];
const DATE_KEYS = ["date", "data", "dt", "vencimento", "due", "datavencto", "datavencimento", "competencia", "comp", "datacompra", "dtcompra", "lancamento", "data_lancamento"];

function normalizeHeader(header: string): string {
    if (!header) return "";
    return header
        .replace(/^\uFEFF/, "")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

function detectColumnIndex(headers: string[], candidates: string[]): number {
    const normalized = headers.map(h => normalizeHeader(h));
    for (const candidate of candidates) {
        const nk = normalizeHeader(candidate);
        const idx = normalized.indexOf(nk);
        if (idx !== -1) return idx;
    }
    return -1;
}

export function normalizeCsvRow(row: (string | undefined)[], headerIndex: { title: number; amount: number; date: number }): {
    title: string;
    rawAmount: string;
    rawDate: string;
} {
    if (!Array.isArray(row)) {
        return { title: "Sem título", rawAmount: "0", rawDate: "" };
    }

    const get = (i: number): string =>
        i >= 0 && i < row.length && row[i] !== undefined && row[i] !== null
            ? String(row[i]).trim()
            : "";

    const title = get(headerIndex.title);
    const rawAmount = get(headerIndex.amount);
    const rawDate = get(headerIndex.date);

    if (title || rawAmount || rawDate) {
        return { title, rawAmount, rawDate };
    }

    // Fallback posicional
    return {
        title: get(0) || "Sem título",
        rawAmount: get(1) || "0",
        rawDate: get(2) || "",
    };
}

export function detectCsvHeaders(headers: string[]): { title: number; amount: number; date: number } {
    return {
        title: detectColumnIndex(headers, TITLE_KEYS),
        amount: detectColumnIndex(headers, AMOUNT_KEYS),
        date: detectColumnIndex(headers, DATE_KEYS),
    };
}

export function parseCsvAmount(raw: string): number {
    if (!raw) return 0;
    const cleaned = String(raw)
        .replace(/[R$\s]/g, "")
        .replace(",", ".")
        .trim();
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : Math.abs(val);
}

export function parseCsvDate(raw: string): string {
    if (!raw) return new Date().toISOString().split("T")[0];

    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];

    const parts = raw.split(/[\/\-]/);
    if (parts.length === 3) {
        if (raw.includes("/")) {
            return `${parts[2].padStart(4, "20")}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
        return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }

    return new Date().toISOString().split("T")[0];
}
